# Dashboards and data visualization

Owner: `forge-ui`, composed with `forge-ux`, `forge-accessibility`, and `forge-performance`.

## Load when

- Dashboards, analytics, operational consoles, dense tables, charts, KPIs, or bulk-data workflows
  are in scope.

## Do not load when

- The interface has no dense data comparison or visualization.
- A decorative statistic does not justify a dashboard system.

## Start from decisions

Name the decision or task each panel supports, the data freshness, comparison baseline, units,
uncertainty, and failure consequence. Put the most consequential current state first; do not fill a
grid simply because space exists. Distinguish empty, zero, delayed, partial, stale, loading, and
error data.

Choose a representation that preserves the comparison: position and length for precise comparison,
tables for exact lookup, and text for a single fact. Avoid pie or decorative chart choices that make
comparison harder. Use direct labels where practical, locale-aware formatting, clear units, and a
text or table alternative. Color cannot be the only series or status distinction.

Design filters, sorting, selection, bulk actions, drill-down, back navigation, and URL state as one
workflow. On narrow screens preserve the task rather than merely hiding columns. Large-data
rendering or virtualization needs measured justification and accessible navigation.

## Evidence

- Realistic dense, sparse, empty, stale, loading, and failed data states.
- Keyboard and non-color interpretation of charts and tables.
- Narrow and wide rendered behavior with exact values still reachable.
- Data-volume and performance measurements when scale is claimed.
