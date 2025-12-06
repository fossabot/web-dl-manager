# Web-DL-Manager - Docker 构建

本项目主要使用 Docker 进行构建和部署。`Dockerfile` 文件处理所有必要的构建步骤，包括安装依赖项和设置应用程序环境。

## 构建 Docker 镜像

要构建 Docker 镜像，请导航到项目根目录并运行：

```bash
docker build -t web-dl-manager .
```

## 运行 Docker 容器

构建镜像后，您可以运行容器：

```bash
# 创建一个本地数据目录
mkdir -p ./gallery-dl-data

# 运行容器
docker run -d \
  -p 5492:5492 \
  -p 127.0.0.1:6275:6275 \
  -v ./gallery-dl-data:/data \
  --name web-dl-manager \
  web-dl-manager
```

有关运行容器和配置环境变量的更详细说明，请参阅 `README.md` 文件。

## 构建要求

-   Docker

`Dockerfile` 文件会处理所有 Python 依赖项和系统软件包。

## 构建包含的内容

-   主应用程序代码
-   所有必需的 Python 和系统依赖项
-   模板和静态文件
-   配置文件

## 注意事项

-   应用程序在 Docker 容器内运行，提供了一个隔离且一致的环境。
-   所有依赖项都在 Docker 镜像内部进行管理。