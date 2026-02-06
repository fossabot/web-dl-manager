const LANGUAGES: Record<string, any> = {
  zh: {
    app_title: "Web-DL-Manager",
    downloader: "下载器",
    tasks: "任务",
    status: "状态",
    settings: "设置",
    start_download: "开始下载",
    // ... add more as needed
  },
  en: {
    app_title: "Web-DL-Manager",
    downloader: "Downloader",
    tasks: "Tasks",
    status: "Status",
    settings: "Settings",
    start_download: "Start Download",
  }
};

export function getLang(code: string = 'zh') {
  return LANGUAGES[code] || LANGUAGES['zh'];
}
