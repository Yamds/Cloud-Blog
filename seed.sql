PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

INSERT INTO users (
  id,
  github_id,
  github_login,
  github_avatar_url,
  github_html_url,
  role,
  created_at,
  updated_at,
  last_login_at
) VALUES (
  'user_admin',
  '0',
  'system-admin',
  'https://avatars.githubusercontent.com/u/0?v=4',
  'https://github.com',
  'admin',
  '2026-05-18T00:00:00.000Z',
  '2026-05-18T00:00:00.000Z',
  '2026-05-18T00:00:00.000Z'
) ON CONFLICT(id) DO UPDATE SET
  github_id = excluded.github_id,
  github_login = excluded.github_login,
  github_avatar_url = excluded.github_avatar_url,
  github_html_url = excluded.github_html_url,
  role = excluded.role,
  updated_at = excluded.updated_at,
  last_login_at = excluded.last_login_at;

INSERT INTO tags (id, name, slug, created_at) VALUES
  ('tag_react', 'React', 'react', '2026-05-18T00:00:00.000Z'),
  ('tag_frontend_architecture', '前端架构', 'frontend-architecture', '2026-05-18T00:00:00.000Z'),
  ('tag_performance', '性能优化', 'performance', '2026-05-18T00:00:00.000Z'),
  ('tag_essay', '随笔', 'essay', '2026-05-18T00:00:00.000Z'),
  ('tag_writing', '写作', 'writing', '2026-05-18T00:00:00.000Z'),
  ('tag_photography', '摄影', 'photography', '2026-05-18T00:00:00.000Z'),
  ('tag_city', '城市', 'city', '2026-05-18T00:00:00.000Z'),
  ('tag_nightscape', '夜景', 'nightscape', '2026-05-18T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  slug = excluded.slug;

INSERT INTO articles (
  id,
  title,
  slug,
  summary,
  icon_name,
  status,
  reading_minutes,
  content_json,
  content_text,
  content_html,
  author_id,
  published_at,
  created_at,
  updated_at,
  archived_at
) VALUES
  (
    'article_react_concurrent_rendering',
    '深入理解 React 并发渲染机制',
    'react-concurrent-rendering',
    'React 18 的并发特性让渲染可以中断与恢复。本文从 Fiber、时间切片与优先级调度解释背后的工程逻辑。',
    'ph:code',
    'published',
    12,
    '[{"type":"paragraph","text":"React 18 引入并发渲染之后，UI 更新不再是单次阻塞式流程。"},{"type":"heading","level":2,"text":"Fiber 是前提"},{"type":"paragraph","text":"Fiber 把渲染过程拆成可调度单元，允许浏览器在任务之间处理输入和绘制。"},{"type":"code","language":"ts","code":"function workLoop() {\\n  while (nextTask && shouldYield() === false) {\\n    nextTask = runTask(nextTask)\\n  }\\n}"},{"type":"blockquote","text":"并发渲染不是让渲染变快，而是让响应更稳定。"},{"type":"list","ordered":false,"items":["可中断渲染","可恢复调度","用户输入优先"]}]',
    'React 18 引入并发渲染之后，UI 更新不再是单次阻塞式流程。 Fiber 是前提。 Fiber 把渲染过程拆成可调度单元，允许浏览器在任务之间处理输入和绘制。 并发渲染不是让渲染变快，而是让响应更稳定。 可中断渲染 可恢复调度 用户输入优先',
    NULL,
    'user_admin',
    '2026-05-15',
    '2026-05-15T08:00:00.000Z',
    '2026-05-15T08:00:00.000Z',
    NULL
  ),
  (
    'article_writing_as_thinking',
    '关于写作的一些思考',
    'writing-as-thinking',
    '写作不是输出环节，而是思考本身。把模糊感写成文字，往往就是认知升级的入口。',
    'ph:pen-nib',
    'published',
    7,
    '[{"type":"paragraph","text":"当一个想法迟迟讲不清楚，通常不是表达问题，而是理解还不够。"},{"type":"heading","level":2,"text":"把模糊写下来"},{"type":"paragraph","text":"先允许粗糙，再逐步重写。每次改写都是一次结构化思考。"}]',
    '当一个想法迟迟讲不清楚，通常不是表达问题，而是理解还不够。 把模糊写下来。 先允许粗糙，再逐步重写。每次改写都是一次结构化思考。',
    NULL,
    'user_admin',
    '2026-05-10',
    '2026-05-10T08:00:00.000Z',
    '2026-05-10T08:00:00.000Z',
    NULL
  ),
  (
    'article_night_city_photography',
    '城市夜色：光影的诗',
    'night-city-photography',
    '深夜街头的灯光、反射与雾气，会把熟悉城市改写成另一种表情。',
    'ph:camera',
    'published',
    5,
    '[{"type":"paragraph","text":"夜晚的颜色不是黑色，而是被光切开的层次。"},{"type":"image","src":"https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80","alt":"城市夜景"},{"type":"paragraph","text":"拍摄时我更在意节奏，而不是绝对锐度。"}]',
    '夜晚的颜色不是黑色，而是被光切开的层次。 城市夜景。 拍摄时我更在意节奏，而不是绝对锐度。',
    NULL,
    'user_admin',
    '2026-05-03',
    '2026-05-03T08:00:00.000Z',
    '2026-05-03T08:00:00.000Z',
    NULL
  )
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  slug = excluded.slug,
  summary = excluded.summary,
  icon_name = excluded.icon_name,
  status = excluded.status,
  reading_minutes = excluded.reading_minutes,
  content_json = excluded.content_json,
  content_text = excluded.content_text,
  content_html = excluded.content_html,
  author_id = excluded.author_id,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at,
  archived_at = excluded.archived_at;

INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES
  ('article_react_concurrent_rendering', 'tag_react'),
  ('article_react_concurrent_rendering', 'tag_frontend_architecture'),
  ('article_react_concurrent_rendering', 'tag_performance'),
  ('article_writing_as_thinking', 'tag_essay'),
  ('article_writing_as_thinking', 'tag_writing'),
  ('article_night_city_photography', 'tag_photography'),
  ('article_night_city_photography', 'tag_city'),
  ('article_night_city_photography', 'tag_nightscape');

COMMIT;
