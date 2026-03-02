/* global Zotero, PathUtils */

const PREF_BRANCH = "extensions.zotero-auto-ingest-organizer.";
const DEFAULT_SCAN_INTERVAL_SEC = 30;
const SUPPORTED_EXTENSIONS = new Set(["pdf"]);

const KEYWORD_COLLECTION_MAP = {
  "llm": ["AI", "LLM"],
  "large language": ["AI", "LLM"],
  "transformer": ["AI", "NLP"],
  "nlp": ["AI", "NLP"],
  "multimodal": ["AI", "Multimodal"],
  "graph": ["Graph", "GNN"],
  "gnn": ["Graph", "GNN"],
  "medical": ["Medical", "Clinical"],
  "biomedical": ["Medical", "Clinical"],
  "vision": ["CV"],
  "diffusion": ["CV", "Generation"]
};

let timerId = null;
let observerId = null;

function getPref(key, fallback) {
  try {
    return Zotero.Prefs.get(PREF_BRANCH + key, true);
  } catch (_err) {
    return fallback;
  }
}

function setPref(key, value) {
  Zotero.Prefs.set(PREF_BRANCH + key, value, true);
}

function getDownloadDir() {
  return getPref("downloadDir", PathUtils.join(PathUtils.homeDir, "Downloads"));
}

function getScanInterval() {
  return Number(getPref("scanIntervalSec", DEFAULT_SCAN_INTERVAL_SEC)) || DEFAULT_SCAN_INTERVAL_SEC;
}

async function startup() {
  Zotero.debug("[auto-ingest] startup");
  if (!getPref("enabled", null)) {
    setPref("enabled", true);
  }
  if (!getPref("scanIntervalSec", null)) {
    setPref("scanIntervalSec", DEFAULT_SCAN_INTERVAL_SEC);
  }
  if (!getPref("downloadDir", null)) {
    setPref("downloadDir", getDownloadDir());
  }

  observerId = Zotero.Notifier.registerObserver({
    async notify(action, type, ids) {
      if (action !== "add" || type !== "item") return;
      for (const id of ids) {
        const item = await Zotero.Items.getAsync(id);
        if (item?.isRegularItem()) {
          await enrichItemByMetadata(item);
          await autoClassifyItem(item);
          await createSummaryNote(item);
        }
      }
    }
  }, ["item"], "auto-ingest-organizer-observer");

  await scanAndImportDownloads();
  timerId = setInterval(scanAndImportDownloads, getScanInterval() * 1000);
}

function shutdown() {
  Zotero.debug("[auto-ingest] shutdown");
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (observerId) {
    Zotero.Notifier.unregisterObserver(observerId);
    observerId = null;
  }
}

async function scanAndImportDownloads() {
  if (!getPref("enabled", true)) return;
  const dir = getDownloadDir();
  const importedFiles = JSON.parse(getPref("importedFiles", "[]") || "[]");
  const importedSet = new Set(importedFiles);

  let entries = [];
  try {
    entries = await IOUtils.getChildren(dir);
  } catch (err) {
    Zotero.logError(`[auto-ingest] 无法读取下载目录: ${dir} -> ${err}`);
    return;
  }

  for (const path of entries) {
    const ext = path.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
    if (importedSet.has(path)) continue;

    try {
      const attachment = await Zotero.Attachments.importFromFile({
        file: path,
        libraryID: Zotero.Libraries.userLibraryID
      });

      let parent = attachment.parentItemID ? await Zotero.Items.getAsync(attachment.parentItemID) : null;
      if (!parent) {
        parent = new Zotero.Item("journalArticle");
        parent.setField("title", fileNameToTitle(path));
        await parent.saveTx();
        attachment.parentID = parent.id;
        await attachment.saveTx();
      }

      await enrichItemByMetadata(parent);
      await autoClassifyItem(parent);
      await createSummaryNote(parent);

      importedSet.add(path);
    } catch (err) {
      Zotero.logError(`[auto-ingest] 导入失败: ${path} -> ${err}`);
    }
  }

  setPref("importedFiles", JSON.stringify([...importedSet]));
}

function fileNameToTitle(path) {
  const name = path.split("/").pop()?.replace(/\.pdf$/i, "") || "Untitled";
  return name.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

async function enrichItemByMetadata(item) {
  const title = item.getField("title")?.trim();
  if (!title) return;

  try {
    const query = encodeURIComponent(title);
    const response = await fetch(`https://api.crossref.org/works?query.title=${query}&rows=1`);
    if (!response.ok) return;
    const data = await response.json();
    const work = data?.message?.items?.[0];
    if (!work) return;

    const abstract = (work.abstract || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const officialTitle = work.title?.[0]?.trim();

    if (officialTitle && officialTitle.length > title.length / 2) {
      item.setField("title", officialTitle);
    }
    if (abstract) {
      item.setField("abstractNote", abstract);
    }

    await item.saveTx();
  } catch (err) {
    Zotero.logError(`[auto-ingest] 元数据补全失败: ${title} -> ${err}`);
  }
}

async function autoClassifyItem(item) {
  const content = `${item.getField("title") || ""} ${item.getField("abstractNote") || ""}`.toLowerCase();
  if (!content.trim()) return;

  const collectionPaths = new Set();
  for (const [keyword, path] of Object.entries(KEYWORD_COLLECTION_MAP)) {
    if (content.includes(keyword)) {
      collectionPaths.add(path.join("/"));
    }
  }

  for (const pathStr of collectionPaths) {
    const collection = await ensureCollectionPath(pathStr);
    if (!item.inCollection(collection.id)) {
      item.addToCollection(collection.id);
    }
  }

  if (collectionPaths.size > 0) {
    await item.saveTx();
  }
}

async function ensureCollectionPath(pathStr) {
  const parts = pathStr.split("/");
  let parentID = null;
  let current = null;

  for (const name of parts) {
    const collections = Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID);
    current = collections.find((c) => c.name === name && c.parentID === parentID);

    if (!current) {
      current = new Zotero.Collection();
      current.libraryID = Zotero.Libraries.userLibraryID;
      current.name = name;
      current.parentID = parentID;
      await current.saveTx();
    }

    parentID = current.id;
  }

  return current;
}

async function createSummaryNote(item) {
  const abstract = item.getField("abstractNote")?.trim();
  if (!abstract) return;

  const firstSentences = abstract
    .split(/(?<=[.!?。！？])\s+/)
    .slice(0, 3)
    .join(" ");

  const noteText = [
    `<h2>自动摘要</h2>`,
    `<p>${escapeHtml(firstSentences || abstract)}</p>`,
    `<h3>关键信息</h3>`,
    `<ul>`,
    `<li><b>标题：</b>${escapeHtml(item.getField("title") || "")}</li>`,
    `<li><b>来源：</b>${escapeHtml(item.getField("publicationTitle") || "待补全")}</li>`,
    `</ul>`
  ].join("\n");

  const existingNotes = item.getNotes();
  for (const noteID of existingNotes) {
    const note = await Zotero.Items.getAsync(noteID);
    if (note?.getNote()?.includes("<h2>自动摘要</h2>")) {
      return;
    }
  }

  const note = new Zotero.Item("note");
  note.libraryID = item.libraryID;
  note.parentID = item.id;
  note.setNote(noteText);
  await note.saveTx();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.startup = startup;
window.shutdown = shutdown;
