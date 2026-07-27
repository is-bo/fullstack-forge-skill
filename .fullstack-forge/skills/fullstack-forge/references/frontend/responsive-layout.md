# Responsive and adaptive layout

Owner: `forge-ui`, composed with `forge-accessibility` and `forge-i18n` when applicable.

## Load when

- Layout, navigation, tables, charts, text expansion, orientation, viewport size, or device class
  matters.
- Creating or reviewing any substantial web interface.

## Do not load when

- A nonvisual change cannot affect rendered geometry.
- A tightly scoped visual correction is already proven at every affected viewport.

## Decide adaptation

Start with content priority and task order, then choose breakpoints where the layout stops working;
do not inherit arbitrary device labels. State what reorders, wraps, collapses, scrolls, becomes a
dialog or sheet, or moves to another view. A desktop grid compressed into a phone is not a mobile
design.

Use resilient flow, intrinsic sizing, bounded measures, flexible media, and logical properties.
Reserve image and asynchronous-content space. Preserve zoom. Account for safe areas, on-screen
keyboards, sticky controls, long unbroken content, text expansion, and both portrait and landscape
where the platform supports them.

For dense tables, preserve comparison tasks: allow intentional horizontal scrolling with a clear
anchor, offer a task-specific compact view, or move secondary detail behind disclosure. Do not hide
essential columns solely to remove overflow.

## Verification

Inspect representative small, medium, and wide widths selected from actual failure points. Include
long content, 200% zoom or equivalent reflow, active keyboard, navigation overlays, and relevant RTL
locales. Record viewport dimensions and observed state. A source review proves intent, not layout.
