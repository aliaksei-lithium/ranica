import type { FC } from 'hono/jsx';
import type { Edition } from '../../model';
import { signed, t } from '../i18n';
import { Block } from './Block';
import { Glyph } from './Glyph';

export const Weather: FC<{ e: Edition }> = ({ e: { facts: f, brief: b } }) => (
  <Block id="weather" label={t(f.lang).weather} unavailable={f.unavailable.weather}>
    {f.weather && (
      <div class="weather">
        <div class="weather-temp">
          {signed(f.weather.max)}°
          <Glyph name={f.weather.glyph} class="weather-glyph" />
        </div>
        <div class="weather-text">
          <p>{f.weather.summary}</p>
          {b.weather_note && <p class="advice">{b.weather_note}</p>}
        </div>
      </div>
    )}
  </Block>
);
