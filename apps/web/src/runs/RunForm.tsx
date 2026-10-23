import { useEffect, useRef, useState, type Dispatch, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ALT_PATH_MAX_FLOOR,
  DIFFICULTIES,
  FINAL_BOSSES,
  FLOOR_MAX,
  FLOOR_MIN,
  MAX_NOTES_LENGTH,
  RUN_RESULTS,
  catalog,
  formatSeed,
  isValidSeedFormat,
  normalizeSeed,
  runInputSchema,
  type RunDraftInput,
} from '@isaac-atlas/shared';
import { errorMessage } from '../auth/errors';
import { useLang } from '../hooks/useLang';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import { TextArea } from '../ui/TextArea';
import { TextField } from '../ui/TextField';
import { draftToInput, type Draft, type DraftAction } from './draft';
import { FloorGroups } from './FloorGroups';
import { floorName } from './floors';
import { ItemPicker } from './ItemPicker';
import { characterLabel } from './labels';
import styles from './RunForm.module.css';

type PickerKind = 'item' | 'trinket';

interface RunFormProps {
  mode: 'create' | 'edit';
  draft: Draft;
  dispatch: Dispatch<DraftAction>;
  onSubmit: (input: RunDraftInput) => void;
  pending: boolean;
  error: unknown;
  /** Crear: descarta el borrador. */
  onDiscard?: () => void;
  /** Editar: vuelve sin guardar. */
  onCancel?: () => void;
}

/** Formulario de una run: lo usan "Nueva run" (con borrador guardado) y "Editar run". */
export function RunForm({
  mode,
  draft,
  dispatch,
  onSubmit,
  pending,
  error,
  onDiscard,
  onCancel,
}: RunFormProps) {
  const { t } = useTranslation();
  const lang = useLang();
  const [pickerKind, setPickerKind] = useState<PickerKind>('item');
  const [submitted, setSubmitted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Atajo Ctrl/Cmd+K: enfoca el buscador de ítems (con modificador: WCAG 2.1.4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey) && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const seedInvalid = draft.seed !== '' && !isValidSeedFormat(draft.seed);
  const problems = {
    seed: submitted && !isValidSeedFormat(draft.seed),
    character: submitted && draft.characterId === null,
    items: submitted && draft.items.length === 0,
  };
  const regular = catalog.characters.filter((c) => !c.tainted);
  const tainted = catalog.characters.filter((c) => c.tainted);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!runInputSchema.safeParse(draftToInput(draft)).success) return;
    onSubmit(draftToInput(draft));
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      <Panel as="h1" title={t(mode === 'create' ? 'run.newTitle' : 'run.editTitle')}>
        <p>{t(mode === 'create' ? 'run.draftNote' : 'run.editNote')}</p>
        {error ? <Notice tone="error">{errorMessage(t, error)}</Notice> : null}

        <div className={styles.grid}>
          <TextField
            label={t('run.seed')}
            placeholder="ABCD 1234"
            hint={t('run.seedHint')}
            error={seedInvalid || problems.seed ? t('run.seedInvalid') : undefined}
            value={draft.seed}
            maxLength={9}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) =>
              dispatch({ type: 'set', patch: { seed: e.target.value.toUpperCase() } })
            }
            onBlur={() => {
              if (isValidSeedFormat(draft.seed)) {
                dispatch({ type: 'set', patch: { seed: formatSeed(normalizeSeed(draft.seed)) } });
              }
            }}
          />

          <Select
            label={t('run.character')}
            value={draft.characterId ?? ''}
            aria-invalid={problems.character || undefined}
            onChange={(e) =>
              dispatch({
                type: 'setCharacter',
                characterId: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          >
            <option value="">{t('run.chooseCharacter')}</option>
            <optgroup label={t('run.regular')}>
              {regular.map((c) => (
                <option key={c.id} value={c.id}>
                  {characterLabel(c, lang, t)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('run.tainted')}>
              {tainted.map((c) => (
                <option key={c.id} value={c.id}>
                  {characterLabel(c, lang, t)}
                </option>
              ))}
            </optgroup>
          </Select>

          <Select
            label={t('run.difficulty')}
            value={draft.difficulty}
            onChange={(e) =>
              dispatch({
                type: 'set',
                patch: { difficulty: e.target.value as (typeof DIFFICULTIES)[number] },
              })
            }
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {t(`difficulty.${d}`)}
              </option>
            ))}
          </Select>
        </div>

        <Checkbox
          label={t('run.fullUnlocks')}
          checked={draft.fullUnlocks}
          onChange={(e) => dispatch({ type: 'setFullUnlocks', value: e.target.checked })}
        />
        <p className={styles.hint}>{t('run.fullUnlocksHint')}</p>
        <p className={styles.hint}>{t('run.innateHint')}</p>
        <p className={styles.hint}>{t('run.rerollHint')}</p>
      </Panel>

      <Panel title={t('run.itemsTitle')}>
        <div className={styles.floorBar} role="group" aria-label={t('run.currentFloor')}>
          <Button
            variant="secondary"
            aria-label={t('run.prevFloor')}
            disabled={draft.floor <= FLOOR_MIN}
            onClick={() => dispatch({ type: 'changeFloor', delta: -1 })}
          >
            −
          </Button>
          <strong className={styles.floorLabel} aria-live="polite">
            {draft.floor}.{' '}
            {floorName(t, draft.floor, draft.floor <= ALT_PATH_MAX_FLOOR ? draft.alt : undefined)}
          </strong>
          <Button
            variant="secondary"
            aria-label={t('run.nextFloor')}
            disabled={draft.floor >= FLOOR_MAX}
            onClick={() => dispatch({ type: 'changeFloor', delta: 1 })}
          >
            +
          </Button>
        </div>

        {draft.floor <= ALT_PATH_MAX_FLOOR ? (
          <Tabs<'normal' | 'alt'>
            label={t('run.path')}
            value={draft.alt ? 'alt' : 'normal'}
            onChange={(path) => dispatch({ type: 'setAlt', value: path === 'alt' })}
            options={[
              { value: 'normal', label: t('run.pathNormal') },
              { value: 'alt', label: t('run.pathAlt') },
            ]}
          />
        ) : null}

        <Tabs<PickerKind>
          label={t('run.pickerKind')}
          value={pickerKind}
          onChange={setPickerKind}
          options={[
            { value: 'item', label: t('run.kindItems') },
            { value: 'trinket', label: t('run.kindTrinkets') },
          ]}
        />
        <ItemPicker
          kind={pickerKind}
          inputRef={searchRef}
          shortcut="Ctrl K"
          onPick={(id) =>
            dispatch(
              pickerKind === 'item'
                ? { type: 'addItem', itemId: id }
                : { type: 'addTrinket', trinketId: id },
            )
          }
        />

        {problems.items ? <Notice tone="error">{t('run.itemsRequired')}</Notice> : null}
        <FloorGroups
          items={draft.items}
          trinkets={draft.trinkets}
          onRemoveItem={(index) => dispatch({ type: 'removeItem', index })}
          onRemoveTrinket={(index) => dispatch({ type: 'removeTrinket', index })}
          onSourceChange={(index, source) => dispatch({ type: 'setItemSource', index, source })}
          onRerollChange={(index, rerolled) =>
            dispatch({ type: 'setItemRerolled', index, rerolled })
          }
        />
      </Panel>

      <Panel title={t('run.outcomeTitle')}>
        <div className={styles.grid}>
          <Select
            label={t('run.result')}
            value={draft.result}
            onChange={(e) =>
              dispatch({
                type: 'set',
                patch: { result: e.target.value as (typeof RUN_RESULTS)[number] },
              })
            }
          >
            {RUN_RESULTS.map((r) => (
              <option key={r} value={r}>
                {t(`results.${r}`)}
              </option>
            ))}
          </Select>

          <Select
            label={t('run.lastFloor')}
            value={draft.lastFloor ?? ''}
            onChange={(e) =>
              dispatch({
                type: 'set',
                patch: { lastFloor: e.target.value === '' ? null : Number(e.target.value) },
              })
            }
          >
            <option value="">—</option>
            {Array.from({ length: FLOOR_MAX }, (_, i) => i + 1).map((f) => (
              <option key={f} value={f}>
                {f}. {t(`floors.${f}`)}
              </option>
            ))}
          </Select>

          {draft.result === 'win' ? (
            <Select
              label={t('run.finalBoss')}
              value={draft.finalBoss ?? ''}
              onChange={(e) =>
                dispatch({ type: 'set', patch: { finalBoss: e.target.value || null } })
              }
            >
              <option value="">—</option>
              {FINAL_BOSSES.map((b) => (
                <option key={b} value={b}>
                  {t(`bosses.${b}`)}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <TextArea
          label={t('run.notes')}
          hint={`${draft.notes.length}/${MAX_NOTES_LENGTH}`}
          maxLength={MAX_NOTES_LENGTH}
          value={draft.notes}
          onChange={(e) => dispatch({ type: 'set', patch: { notes: e.target.value } })}
        />

        <div className={styles.actions}>
          <Button type="submit" disabled={pending}>
            {t(mode === 'create' ? 'run.save' : 'run.saveChanges')}
          </Button>
          {onDiscard ? (
            <Button
              variant="danger"
              onClick={() => {
                setSubmitted(false);
                onDiscard();
              }}
            >
              {t('run.discard')}
            </Button>
          ) : null}
          {onCancel ? (
            <Button variant="secondary" onClick={onCancel}>
              {t('run.cancel')}
            </Button>
          ) : null}
        </div>
      </Panel>
    </form>
  );
}
