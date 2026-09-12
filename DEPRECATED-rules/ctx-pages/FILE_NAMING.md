# FILE NAMING RULES

## Case

- **REQUIRED**: Use `kebab-case` for all files in `src/pages/`.
- **FORBIDDEN**: Do not use camelCase (e.g., `adminList.ts`), snake_case (`admin_list.ts`), or PascalCase (`AdminList.ts`).

✅ Correct:
```
admin.ts
admin-list.ts
start.ts
item-detail.ts
```

❌ Incorrect:
```
AdminList.ts
admin_list.ts
adminList.ts
```

## Parent-Child Structure

When a page has sub-pages (children), use the `<parent>-<child>.ts` structure.

Rules:
1. **Parent file**: Main file name without any hyphen, e.g., `admin.ts`.
2. **Child file**: File name prefixed with `parent-` followed by the child name, e.g., `admin-list.ts`, `admin-create.ts`.
3. **Deeper levels**: Append segments for each level: `<parent>-<child>-<grandchild>-<greatgrandchild>.ts`. No hard limit — maximum 5 levels recommended for readability.

### Example

```
src/pages/
├── admin.ts              # Main admin page
├── admin-create.ts       # Child: create data form (from admin)
├── admin-list.ts         # Child: data list (from admin)
├── admin-list-detail.ts  # Grandchild: item detail from list (from admin-list)
├── start.ts              # Standalone start page (no child)
└── help.ts               # Standalone help page (no child)
```

### When to Use Parent-Child

Use parent-child when:
- A page **navigates** to another page that is logically part of it.
- Multiple pages **share the same context** (e.g., CRUD features for the same entity).

No parent-child needed for:
- Standalone pages with no hierarchical relationship, e.g., `start.ts`, `help.ts`.
- Separate domains — just use a descriptive file name.

### Example Mapping (CRUD for "Item" Entity)

```
item.ts          → Item parent/menu
item-create.ts   → Create item
item-list.ts     → List item
item-detail.ts   → Detail item
item-update.ts   → Update item
item-delete.ts   → Delete item
```

### Example Mapping (Multi-Level)

```
order.ts              → Order parent
order-list.ts         → Order list
order-list-detail.ts  → Detail of an order from the list
order-checkout.ts     → Order checkout
```
