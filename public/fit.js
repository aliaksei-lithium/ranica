// Fit-to-page (docs/02-plan.md §2). Each .sheet is an A4 page with min-height 297 mm. The flow is
// overfilled on purpose, so:
// 1. trim: while the sheet is too tall, remove the lowest-priority block (highest data-priority,
//    last on the sheet first). P1 blocks are never removed.
// 2. refill: try the removed blocks again, most important first; keep each one that still fits.
//    This closes the gaps a large removed block leaves, e.g. with one-liners.
// 3. carry: removed one-liners move to the next sheet's [data-fit-receive] list (back page) and
//    are fitted there with the rest of that sheet, instead of being dropped.
// 4. tidy: drop containers marked data-fit-empty whose items were all removed (an empty label).
// Result: <body data-fit-done="ok|overflow" data-trimmed="block,block"> for the renderer.
(async () => {
  await document.fonts.ready;
  const removed = [];
  let overflow = false;
  const sheets = [...document.querySelectorAll('.sheet')];
  for (const [n, sheet] of sheets.entries()) {
    const limit = parseFloat(getComputedStyle(sheet).minHeight);
    const tooTall = () => sheet.getBoundingClientRect().height > limit + 1;
    const out = [];
    while (tooTall()) {
      const candidates = [...sheet.querySelectorAll('[data-priority]')].filter((b) => Number(b.dataset.priority) > 1);
      if (candidates.length === 0) break;
      const lowest = Math.max(...candidates.map((b) => Number(b.dataset.priority)));
      const victim = candidates.filter((b) => Number(b.dataset.priority) === lowest).pop();
      const mark = document.createComment('fit');
      victim.replaceWith(mark);
      out.push({ el: victim, mark });
    }
    // Refill: most important first (lowest priority number), then in page order.
    const order = [...out].sort((a, b) => Number(a.el.dataset.priority) - Number(b.el.dataset.priority) || out.indexOf(b) - out.indexOf(a));
    for (const x of order) {
      x.mark.replaceWith(x.el);
      if (tooTall()) x.el.replaceWith(x.mark);
      else x.mark = null;
    }
    const receiver = sheets[n + 1]?.querySelector('[data-fit-receive] ul');
    for (const x of [...out].reverse()) { // page order (trimming went from the end)
      if (!x.mark) continue;
      x.mark.remove();
      if (receiver && x.el.dataset.block === 'brief') receiver.append(x.el);
      else removed.push(x.el.dataset.block);
    }
    for (const box of sheet.querySelectorAll('[data-fit-empty]')) {
      if (!box.querySelector(box.dataset.fitEmpty)) box.remove();
    }
    overflow ||= tooTall();
  }
  document.body.dataset.trimmed = removed.join(',');
  document.body.dataset.fitDone = overflow ? 'overflow' : 'ok';
})();
