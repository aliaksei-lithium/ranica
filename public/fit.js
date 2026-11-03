// Fit-to-page (docs/02-plan.md §2). Each .sheet is an A4 page with min-height 297 mm; when its
// content makes it taller, remove the lowest-priority block on that sheet (highest
// data-priority, last on the sheet first) until it fits. P1 blocks are never removed.
// Result: <body data-fit-done="ok|overflow" data-trimmed="block,block"> for the renderer.
(async () => {
  await document.fonts.ready;
  const removed = [];
  let overflow = false;
  for (const sheet of document.querySelectorAll('.sheet')) {
    const limit = parseFloat(getComputedStyle(sheet).minHeight);
    const tooTall = () => sheet.getBoundingClientRect().height > limit + 1;
    while (tooTall()) {
      const candidates = [...sheet.querySelectorAll('[data-priority]')].filter((b) => Number(b.dataset.priority) > 1);
      if (candidates.length === 0) break;
      const lowest = Math.max(...candidates.map((b) => Number(b.dataset.priority)));
      const victim = candidates.filter((b) => Number(b.dataset.priority) === lowest).pop();
      removed.push(victim.dataset.block);
      victim.remove();
    }
    overflow ||= tooTall();
  }
  document.body.dataset.trimmed = removed.join(',');
  document.body.dataset.fitDone = overflow ? 'overflow' : 'ok';
})();
