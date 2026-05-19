import type { Article } from "../types/article";

export const mockArticles: Article[] = [
  {
    slug: "react-concurrent-rendering",
    title: "深入理解 React 并发渲染机制",
    summary:
      "React 18 的并发特性让渲染可以中断与恢复。本文从 Fiber、时间切片与优先级调度解释背后的工程逻辑。",
    iconName: "ph:code",
    icon_name: "ph:code",
    tags: ["React", "前端架构", "性能优化"],
    publishedAt: "2026-05-15",
    readingMinutes: 12,
    content: [
      { type: "paragraph", text: "React 18 引入并发渲染之后，UI 更新不再是单次阻塞式流程。" },
      { type: "heading", level: 2, text: "Fiber 是前提" },
      {
        type: "paragraph",
        text: "Fiber 把渲染过程拆成可调度单元，允许浏览器在任务之间处理输入和绘制。",
      },
      {
        type: "code",
        language: "ts",
        code: "function workLoop() {\n  while (nextTask && shouldYield() === false) {\n    nextTask = runTask(nextTask)\n  }\n}",
      },
      {
        type: "blockquote",
        text: "并发渲染不是让渲染变快，而是让响应更稳定。",
      },
      {
        type: "list",
        ordered: false,
        items: ["可中断渲染", "可恢复调度", "用户输入优先"],
      },
    ],
    comments: [
      {
        id: "c1",
        authorName: "Yuki",
        authorAvatar: "https://avatars.githubusercontent.com/u/583231?v=4",
        createdAt: "2026-05-16 10:24",
        content: "这篇把时间切片讲得很清楚，尤其是“更稳而不是更快”这句很到位。",
        replies: [
          {
            id: "c1-r1",
            authorName: "Aster",
            authorAvatar: "https://avatars.githubusercontent.com/u/810438?v=4",
            createdAt: "2026-05-16 11:02",
            content: "同感，之前我总把并发等同于性能翻倍。",
          },
        ],
      },
      {
        id: "c2",
        authorName: "Nora",
        authorAvatar: "https://avatars.githubusercontent.com/u/1024025?v=4",
        createdAt: "2026-05-16 13:11",
        content: "希望后续也能写一篇关于 transition 与 suspense 的实践。",
      },
    ],
  },
  {
    slug: "writing-as-thinking",
    title: "关于写作的一些思考",
    summary: "写作不是输出环节，而是思考本身。把模糊感写成文字，往往就是认知升级的入口。",
    iconName: "ph:pen-nib",
    icon_name: "ph:pen-nib",
    tags: ["随笔", "写作"],
    publishedAt: "2026-05-10",
    readingMinutes: 7,
    content: [
      { type: "paragraph", text: "当一个想法迟迟讲不清楚，通常不是表达问题，而是理解还不够。" },
      { type: "heading", level: 2, text: "把模糊写下来" },
      { type: "paragraph", text: "先允许粗糙，再逐步重写。每次改写都是一次结构化思考。" },
    ],
    comments: [],
  },
  {
    slug: "night-city-photography",
    title: "城市夜色：光影的诗",
    summary: "深夜街头的灯光、反射与雾气，会把熟悉城市改写成另一种表情。",
    iconName: "ph:camera",
    icon_name: "ph:camera",
    tags: ["摄影", "城市", "夜景"],
    publishedAt: "2026-05-03",
    readingMinutes: 5,
    content: [
      { type: "paragraph", text: "夜晚的颜色不是黑色，而是被光切开的层次。" },
      {
        type: "image",
        src: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80",
        alt: "城市夜景",
      },
      { type: "paragraph", text: "拍摄时我更在意节奏，而不是绝对锐度。" },
    ],
    comments: [],
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return mockArticles.find((article) => article.slug === slug);
}
