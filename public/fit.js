// Fit-to-page (docs/02-plan.md §2): while a column overflows the A4 sheet, remove the
// lowest-priority block in that column (highest data-priority number, last on the page first).
// P1 blocks are never removed. The result is written to <body data-fit-done data-trimmed>
// so the renderer (scripts/render.mjs, later Browser Run) knows when to print.
(async () => {
  await document.fonts.ready;
  const cols = [...document.querySelectorAll('.col')];
  const over = () => cols.filter((c) => c.scrollHeight > c.clientHeight + 1);
  const overflowing = () => over().length > 0;
  const removed = [];
  while (overflowing()) {
    const candidates = over()
      .flatMap((c) => [...c.querySelectorAll('[data-priority]')])
      .filter((b) => Number(b.dataset.priority) > 1);
    if (candidates.length === 0) break;
    const lowest = Math.max(...candidates.map((b) => Number(b.dataset.priority)));
    const victim = candidates.filter((b) => Number(b.dataset.priority) === lowest).pop();
    removed.push(victim.dataset.block);
    victim.remove();
  }
  document.body.dataset.trimmed = removed.join(',');
  document.body.dataset.fitDone = overflowing() ? 'overflow' : 'ok';
})();
