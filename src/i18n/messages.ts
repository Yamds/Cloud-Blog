import type { AppLocale } from "@/stores/language";

export type MessageKey =
  | "nav.home"
  | "nav.articles"
  | "nav.cms"
  | "nav.backHome"
  | "nav.login"
  | "nav.loggingIn"
  | "nav.logout"
  | "nav.userProfile"
  | "nav.language"
  | "nav.languageZh"
  | "nav.languageEn"
  | "theme.light"
  | "theme.dark"
  | "theme.hue"
  | "home.scrollToArticles"
  | "home.recentWritings"
  | "home.loading"
  | "home.empty"
  | "articles.all"
  | "articles.tagTitle"
  | "articles.tagDescription"
  | "articles.viewAll"
  | "articles.loading"
  | "articles.empty"
  | "article.read"
  | "article.backToList"
  | "article.outline"
  | "article.loading"
  | "article.unavailable"
  | "article.notFound"
  | "article.notFoundDescription"
  | "article.backToArticles"
  | "article.readingTime"
  | "article.minutes"
  | "copyright.title"
  | "copyright.articleTitle"
  | "copyright.articleUrl"
  | "copyright.author"
  | "copyright.license"
  | "copyright.licenseCopy"
  | "copyright.licenseCopyPrefix"
  | "copyright.licenseCopySuffix"
  | "copyright.publishedAt"
  | "copyright.updatedAt"
  | "copyright.defaultAuthor"
  | "comments.title"
  | "comments.loggedInAs"
  | "comments.loginRequired"
  | "comments.loginButton"
  | "comments.authChecking"
  | "comments.closed"
  | "comments.loginHint"
  | "comments.placeholder"
  | "comments.submit"
  | "comments.submitting"
  | "comments.loading"
  | "comments.empty"
  | "comments.confirmDelete"
  | "comments.reply"
  | "comments.collapseReply"
  | "comments.delete"
  | "comments.deleting"
  | "comments.replyPlaceholder"
  | "comments.cancel"
  | "comments.sendReply"
  | "comments.sendingReply";

type MessageDictionary = Record<MessageKey, string>;

export const messages: Record<AppLocale, MessageDictionary> = {
  zh: {
    "nav.home": "首页",
    "nav.articles": "文章",
    "nav.cms": "CMS",
    "nav.backHome": "返回首页",
    "nav.login": "GitHub 登录",
    "nav.loggingIn": "连接中...",
    "nav.logout": "登出",
    "nav.userProfile": "{name} 的 GitHub 主页",
    "nav.language": "界面语言",
    "nav.languageZh": "中",
    "nav.languageEn": "EN",
    "theme.light": "切换到浅色主题",
    "theme.dark": "切换到深色主题",
    "theme.hue": "调整主题色相",
    "home.scrollToArticles": "滚动到文章列表",
    "home.recentWritings": "最近文章",
    "home.loading": "文章加载中...",
    "home.empty": "公开文章还在整理中。",
    "articles.all": "全部文章",
    "articles.tagTitle": "标签：{tag}",
    "articles.tagDescription": "共 {count} 篇文章使用这个标签。",
    "articles.viewAll": "查看全部",
    "articles.loading": "文章加载中...",
    "articles.empty": "当前标签下还没有可展示的公开文章。",
    "article.read": "阅读文章：{title}",
    "article.backToList": "返回列表",
    "article.outline": "目录",
    "article.loading": "文章加载中...",
    "article.unavailable": "文章暂时不可用",
    "article.notFound": "文章不存在",
    "article.notFoundDescription": "当前 slug 未找到对应内容。",
    "article.backToArticles": "回到文章列表",
    "article.readingTime": "阅读时长 {minutes} 分钟",
    "article.minutes": "{minutes} 分钟",
    "copyright.title": "版权说明",
    "copyright.articleTitle": "文章标题",
    "copyright.articleUrl": "文章 URL",
    "copyright.author": "文章作者",
    "copyright.license": "许可协议",
    "copyright.licenseCopy": "转载或引用本文时请遵守 {license} 许可协议，注明出处，不得用于商业用途。",
    "copyright.licenseCopyPrefix": "转载或引用本文时请遵守 ",
    "copyright.licenseCopySuffix": " 许可协议，注明出处，不得用于商业用途。",
    "copyright.publishedAt": "发布日期",
    "copyright.updatedAt": "更新日期",
    "copyright.defaultAuthor": "本站作者",
    "comments.title": "评论 {count}",
    "comments.loggedInAs": "已登录为 {name}",
    "comments.loginRequired": "仅支持使用 GitHub 账号发表评论",
    "comments.loginButton": "登录后评论",
    "comments.authChecking": "检查中...",
    "comments.closed": "评论发布已关闭，但历史评论仍然可见。",
    "comments.loginHint": "登录后即可评论、回复，并删除自己的评论。",
    "comments.placeholder": "写点什么...",
    "comments.submit": "发布评论",
    "comments.submitting": "发布中...",
    "comments.loading": "评论加载中...",
    "comments.empty": "还没有评论，来聊两句吧。",
    "comments.confirmDelete": "确定删除这条评论吗？",
    "comments.reply": "回复",
    "comments.collapseReply": "收起回复",
    "comments.delete": "删除",
    "comments.deleting": "删除中...",
    "comments.replyPlaceholder": "写下你的回复...",
    "comments.cancel": "取消",
    "comments.sendReply": "发送回复",
    "comments.sendingReply": "发送中...",
  },
  en: {
    "nav.home": "Home",
    "nav.articles": "Articles",
    "nav.cms": "CMS",
    "nav.backHome": "Back to home",
    "nav.login": "Sign in with GitHub",
    "nav.loggingIn": "Connecting...",
    "nav.logout": "Sign out",
    "nav.userProfile": "{name}'s GitHub profile",
    "nav.language": "Interface language",
    "nav.languageZh": "中",
    "nav.languageEn": "EN",
    "theme.light": "Switch to light theme",
    "theme.dark": "Switch to dark theme",
    "theme.hue": "Adjust theme hue",
    "home.scrollToArticles": "Scroll to articles",
    "home.recentWritings": "Recent Writings",
    "home.loading": "Loading articles...",
    "home.empty": "Public posts are still being arranged.",
    "articles.all": "All Articles",
    "articles.tagTitle": "Tag: {tag}",
    "articles.tagDescription": "{count} articles use this tag.",
    "articles.viewAll": "View all",
    "articles.loading": "Loading articles...",
    "articles.empty": "There are no public articles under this tag yet.",
    "article.read": "Read article: {title}",
    "article.backToList": "Back to list",
    "article.outline": "Outline",
    "article.loading": "Loading article...",
    "article.unavailable": "This article is temporarily unavailable",
    "article.notFound": "Article not found",
    "article.notFoundDescription": "No content was found for this slug.",
    "article.backToArticles": "Back to articles",
    "article.readingTime": "{minutes} min read",
    "article.minutes": "{minutes} min",
    "copyright.title": "Copyright",
    "copyright.articleTitle": "Title",
    "copyright.articleUrl": "Article URL",
    "copyright.author": "Author",
    "copyright.license": "License",
    "copyright.licenseCopy": "When reposting or quoting this article, follow the {license} license, include attribution, and avoid commercial use.",
    "copyright.licenseCopyPrefix": "When reposting or quoting this article, follow the ",
    "copyright.licenseCopySuffix": " license, include attribution, and avoid commercial use.",
    "copyright.publishedAt": "Published",
    "copyright.updatedAt": "Updated",
    "copyright.defaultAuthor": "Site author",
    "comments.title": "Comments {count}",
    "comments.loggedInAs": "Signed in as {name}",
    "comments.loginRequired": "Comments require a GitHub account",
    "comments.loginButton": "Sign in to comment",
    "comments.authChecking": "Checking...",
    "comments.closed": "New comments are closed, but existing comments remain visible.",
    "comments.loginHint": "Sign in to comment, reply, and delete your own comments.",
    "comments.placeholder": "Write something...",
    "comments.submit": "Post comment",
    "comments.submitting": "Posting...",
    "comments.loading": "Loading comments...",
    "comments.empty": "No comments yet. Start the conversation.",
    "comments.confirmDelete": "Delete this comment?",
    "comments.reply": "Reply",
    "comments.collapseReply": "Hide reply",
    "comments.delete": "Delete",
    "comments.deleting": "Deleting...",
    "comments.replyPlaceholder": "Write your reply...",
    "comments.cancel": "Cancel",
    "comments.sendReply": "Send reply",
    "comments.sendingReply": "Sending...",
  },
};
