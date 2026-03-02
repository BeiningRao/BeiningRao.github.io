# beining.github.io

这是你的 GitHub 个人主页仓库。

## 现在主页在哪？
你当前看到的是**本地版本**（开发环境目录）：

- `/workspace/beining.github.io/index.html`

它还没有自动出现在公网，除非你把代码推送到 GitHub 对应仓库并开启 GitHub Pages。

## 如何本地查看
在仓库目录运行：

```bash
python -m http.server 4173
```

然后打开：

- `http://127.0.0.1:4173`

## 如何发布到 GitHub Pages
> 你的仓库名是 `beining.github.io`，这是 **User Site** 仓库名格式。发布成功后默认网址就是：
>
> - `https://beining.github.io`

### 1) 把本地代码推到 GitHub
如果你还没关联远程仓库：

```bash
git remote add origin git@github.com:beining/beining.github.io.git
```

推送当前分支（假设主分支叫 `main`）：

```bash
git push -u origin main
```

> 如果你的默认分支叫 `master`，就把命令里的 `main` 换成 `master`。

### 2) 在 GitHub 页面确认 Pages 设置
进入仓库：

- `https://github.com/beining/beining.github.io`

然后：

- `Settings` → `Pages`
- `Build and deployment` 里选择：
  - `Source`: `Deploy from a branch`
  - `Branch`: `main`（或 `master`）
  - Folder: `/ (root)`

保存后等待 1~2 分钟。

### 3) 访问线上主页
打开：

- `https://beining.github.io`

如果刚开启还没生效，等几分钟后刷新。

## 常见问题
- **为什么打开还是 404？**
  - 检查仓库名是否完全等于 `beining.github.io`
  - 检查 Pages 是否选择了正确分支和 root 目录
  - 刚发布时有缓存，稍等再试

- **我修改了主页怎么更新线上？**
  - 本地改完后执行 `git add . && git commit -m "update homepage" && git push`
  - GitHub Pages 会自动重新部署
