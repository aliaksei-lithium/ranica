import type { FC } from 'hono/jsx';
import type { Edition } from '../../model';
import { t } from '../i18n';
import { Block } from './Block';

export const Today: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) => {
  const L = t(f.lang);
  const notes = new Map(b.agenda.map((a) => [a.event_id, a.note]));
  const contexts = new Map(b.tasks.map((x) => [x.task_id, x.context]));
  const events = f.events.slice(0, 6);
  const tasks = f.tasks.slice(0, 6);
  return (
    <Block id="today" label={L.today} unavailable={f.unavailable.today}>
      {events.length === 0 ? (
        <p class="empty">{L.noEvents}</p>
      ) : (
        <ul class="agenda">
          {events.map((ev) => {
            const detail = [ev.durationMin ? `${ev.durationMin} ${L.min}` : null, ev.place].filter(Boolean).join(', ');
            const note = notes.get(ev.id);
            return (
              <li>
                <span class="time">{ev.time}</span>
                <span class="what">
                  <b>{ev.title}</b>
                  {detail && <span class="detail"> · {detail}</span>}
                  {note && <span class="note">{note}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length === 0 ? (
        <p class="empty">{L.noTasks}</p>
      ) : (
        <ul class="tasks" aria-label={L.tasks}>
          {tasks.map((task) => {
            const ctx = contexts.get(task.id);
            return (
              <li>
                <span class="box" aria-hidden="true" />
                <span class="what">
                  {task.title}
                  {ctx && <span class="note">{ctx}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
};
