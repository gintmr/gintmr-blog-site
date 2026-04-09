# Supabase SQL Setup

本项目现在只保留一份正式 SQL 真源：

- [supabase-schema.sql](/Users/gintmr/Downloads/Self/Gintmrs-Personal-Page/gintmr-blog-site/supabase-schema.sql)

这份文件已经包含：

- 旧 visitor 函数签名清理
- reactions / page views / visitors / private settings 全量功能
- RLS、权限、索引、触发器
- 新版 visitors_info 需要的增强字段

## 推荐执行流程

1. 先打开 Supabase 控制台。
2. 进入 `SQL Editor`。
3. 新建一个 query，名字建议叫 `Project Schema`。
4. 把 [supabase-schema.sql](/Users/gintmr/Downloads/Self/Gintmrs-Personal-Page/gintmr-blog-site/supabase-schema.sql) 的完整内容复制进去。
5. 直接执行。

## 设置 visitors_info 密码

在同一个 SQL Editor 里再执行一次：

```sql
select public.set_visitors_info_password('你的密码');
```

## 验证是否成功

执行下面两条：

```sql
select * from public.get_visitors_overview_secure('你的密码');
select * from public.get_visitor_sessions_secure('你的密码', 5, null);
```

如果能正常返回数据，说明新版 SQL 已经接管成功。

## 如何清理 Supabase 里旧的 saved queries

旧的 saved queries 只是 SQL Editor 里的历史脚本，不是数据库对象本身。现在建议只保留一个新的 `Project Schema` 查询，其余旧 query 可以手动删除：

1. 在 `SQL Editor` 左侧找到旧 query。
2. 打开每条 query 的菜单。
3. 选择 `Delete`。
4. 最终只保留你想继续留档的新版 query。

建议删除你之前那几条旧脚本，例如：

- `Check Visitor Password`
- `Reactions, Page Views & Visitors...`
- `Page Visit Statistics`
- `Get page visit stats`
- `Emoji Reaction System`

## 后续维护原则

- 以后只维护仓库里的 [supabase-schema.sql](/Users/gintmr/Downloads/Self/Gintmrs-Personal-Page/gintmr-blog-site/supabase-schema.sql)。
- Supabase SQL Editor 里的 query 只作为执行入口和留档，不再手工拆分维护。
- 如果将来 visitor 函数返回字段再变化，继续在这份文件顶部补 `DROP FUNCTION IF EXISTS ...` 即可，避免再次撞上 return type 冲突。
