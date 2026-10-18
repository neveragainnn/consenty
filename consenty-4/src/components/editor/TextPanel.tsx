"use client";

import { EDITOR_FONTS } from "@/app/fonts";
import { MAX_TEXT_LAYERS, MAX_TEXT_LENGTH } from "@/config/limits";
import type { PrintGeometry } from "@/config/products";
import { centerText, createTextLayer, measureText } from "@/lib/design/layers";
import { updateSide, useEditor } from "@/lib/design/store";
import type { SideId, TextLayer } from "@/lib/types";
import { Button } from "../ui/Button";
import { Slider } from "../ui/Slider";
import { IconTrash } from "./icons";

const COLORS = ["#FFFFFF", "#1D1E21", "#FF5B14", "#FFD23F", "#2F5BFF", "#E8326B", "#2F8F5B", "#C3C5C9"];

export function TextPanel({ sideId, geo }: { sideId: SideId; geo: PrintGeometry }) {
  const texts = useEditor((s) => s.design[sideId].texts);
  const selectedId = useEditor((s) => s.selectedId);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);

  const selected = texts.find((t) => t.id === selectedId);

  const patch = (id: string, p: Partial<TextLayer>, record = false) => {
    const fn = updateSide(sideId, (s) => ({ ...s, texts: s.texts.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
    if (record) apply(fn);
    else update(fn);
  };

  const add = () => {
    const layer = createTextLayer(geo, EDITOR_FONTS[0].family, texts.length);
    apply(updateSide(sideId, (s) => ({ ...s, texts: [...s.texts, layer] })));
    select(layer.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {texts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            aria-pressed={t.id === selectedId}
            className={`max-w-[12rem] truncate rounded-full border px-3 py-1.5 text-sm ${
              t.id === selectedId ? "border-ink bg-ink text-alu" : "border-ink/20 hover:border-ink"
            }`}
          >
            {t.text.trim() || "Пустая надпись"}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={add} disabled={texts.length >= MAX_TEXT_LAYERS}>
          + Добавить текст
        </Button>
      </div>

      {!selected && texts.length > 0 && <p className="text-sm text-steel">Выберите надпись, чтобы изменить её.</p>}
      {!texts.length && <p className="text-sm text-steel">Надпись ляжет поверх фото. Её можно двигать и поворачивать прямо на изделии.</p>}

      {selected && (
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm text-ink-2">Текст</span>
            <textarea
              value={selected.text}
              maxLength={MAX_TEXT_LENGTH}
              rows={2}
              onChange={(e) => patch(selected.id, { text: e.target.value })}
              onBlur={commit}
              className="mt-1 w-full resize-none rounded-xl border border-ink/20 bg-white/60 px-3 py-2 outline-none focus:border-ink"
            />
          </label>

          <div>
            <span className="text-sm text-ink-2">Шрифт</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {EDITOR_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => patch(selected.id, { fontFamily: f.family }, true)}
                  aria-pressed={selected.fontFamily === f.family}
                  style={{ fontFamily: f.family }}
                  className={`truncate rounded-xl border px-3 py-2 text-left ${
                    selected.fontFamily === f.family ? "border-ink bg-white/70" : "border-ink/15 hover:border-ink/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm text-ink-2">Цвет</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Цвет ${c}`}
                  aria-pressed={selected.fill.toUpperCase() === c}
                  onClick={() => patch(selected.id, { fill: c }, true)}
                  className={`size-8 rounded-full border ${selected.fill.toUpperCase() === c ? "ring-2 ring-ink ring-offset-2 ring-offset-alu" : "border-ink/20"}`}
                  style={{ background: c }}
                />
              ))}
              <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border border-ink/20 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Свой цвет">
                <input
                  type="color"
                  value={selected.fill}
                  onChange={(e) => patch(selected.id, { fill: e.target.value })}
                  onBlur={commit}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Выбрать свой цвет"
                />
              </label>
            </div>
          </div>

          <Slider
            label="Размер"
            value={Math.round(selected.fontSize)}
            min={Math.round(geo.trim.height * 0.03)}
            max={Math.round(geo.trim.height * 0.6)}
            format={(v) => `${(v / geo.pxPerMm).toFixed(1)} мм`}
            onChange={(v) => patch(selected.id, { fontSize: v })}
            onCommit={commit}
          />
          {(() => {
            // Положение — по центру надписи, в % от области печати
            const m = measureText(selected);
            const cx = selected.x + m.width / 2, cy = selected.y + m.height / 2;
            return (
              <>
                <Slider
                  label="По горизонтали"
                  value={Math.round((cx / geo.width) * 100)}
                  min={0}
                  max={100}
                  format={(v) => `${v - 50 > 0 ? "+" : ""}${v - 50}`}
                  onChange={(v) => patch(selected.id, { x: (v / 100) * geo.width - m.width / 2 })}
                  onCommit={commit}
                />
                <Slider
                  label="По вертикали"
                  value={Math.round((cy / geo.height) * 100)}
                  min={0}
                  max={100}
                  format={(v) => `${v - 50 > 0 ? "+" : ""}${v - 50}`}
                  onChange={(v) => patch(selected.id, { y: (v / 100) * geo.height - m.height / 2 })}
                  onCommit={commit}
                />
              </>
            );
          })()}
          <p className="text-xs text-steel">Надпись можно перетаскивать прямо на изделии — мышью или пальцем.</p>
          <Slider
            label="Поворот"
            value={Math.round(selected.rotation)}
            min={-180}
            max={180}
            format={(v) => `${v}°`}
            onChange={(v) => patch(selected.id, { rotation: v })}
            onCommit={commit}
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="bg-ink/5" onClick={() => apply(updateSide(sideId, (s) => ({ ...s, texts: s.texts.map((t) => (t.id === selected.id ? centerText(t, geo) : t)) })))}>
              По центру
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                apply(updateSide(sideId, (s) => ({ ...s, texts: s.texts.filter((t) => t.id !== selected.id) })));
                select(null);
              }}
            >
              <IconTrash /> Удалить надпись
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
