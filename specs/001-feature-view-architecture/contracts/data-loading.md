# Contract: Primary Gate and Partial Component Loading

## Primary Context

The application host owns one main gate around the route subtree sharing a primary profile context.

| Gate state  | Required output                                 | View mounted |
| ----------- | ----------------------------------------------- | ------------ |
| Loading     | Full-page loading outcome                       | No           |
| Error       | Established full-page problem outcome           | No           |
| Unavailable | Full-page unavailable outcome and escape action | No           |
| Ready       | Route subtree                                   | Yes          |

The gate may warm shared query state before mounting the subtree. A view reads that ready state
through the data boundary; it does not receive the resolved object as a prop or add a second
whole-page gate.

## Additional Component Data

Once primary context is ready, a view may render partially loaded content. Each component requiring
additional data owns its local state.

| Component state | Required output                                    | Ready sibling content |
| --------------- | -------------------------------------------------- | --------------------- |
| Loading         | Component-scoped skeleton or progress state        | Remains visible       |
| Error           | Component-scoped problem and retry when applicable | Remains visible       |
| Empty           | Component-scoped empty state                       | Remains visible       |
| Ready           | Component content                                  | Remains visible       |

Changing the primary identifier invalidates component state associated with the previous context.
No component displays stale data as belonging to the new context.

## Embedded Hosts

A host outside either Navigator app supplies an equivalent primary-context gate. This preserves the
view contract without coupling it to one router implementation.
