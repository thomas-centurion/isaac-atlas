import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import {
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
} from '@isaac-atlas/shared';
import { useCreateRun } from '../api/runs';
import { errorMessage } from '../auth/errors';
import { useLang } from '../hooks/useLang';
import { ItemPicker } from '../runs/ItemPicker';
import { FloorGroups } from '../runs/FloorGroups';
import { draftToInput, isDraftEmpty, useRunDraft } from '../runs/draft';
import { characterLabel } from '../runs/labels';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import { TextArea } from '../ui/TextArea';
import { TextField } from '../ui/TextField';
import styles from './NewRun.module.css';

type PickerKind = 'item' | 'trinket';

export function NewRun() {
  const { t } = useTranslation();
  usePageTitle(t('run.newTitle'));
  const lang = useLang();
  const navigate = useNavigate();
  const create = useCreateRun();
  const [draft, dispatch, clearDraft] = useRunDraft();
  const [pickerKind, setPickerKind] = useState<PickerKind>('item');
  const [submitted, setSubmitted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Atajo "/": enfoca el buscador, salvo que ya se esté escribiendo en un campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const parsed = runInputSchema.safeParse(draftToInput(draft));
    if (!parsed.success) return;
    create.mutate(draftToInput(draft), {
      onSuccess: (run) => {
        clearDraft();
        navigate(`/runs/${run.id}`);
      },
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Panel as="h1" title={t('run.newTitle')}>
        <p>{t('run.draftNote')}</p>
        {create.error ? <Notice tone="error">{errorMessage(t, create.error)}</Notice> : null}

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
                type: 'set',
                patch: { characterId: e.target.value === '' ? null : Number(e.target.value) },
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
          onChange={(e) => dispatch({ type: 'set', patch: { fullUnlocks: e.target.checked } })}
        />
        <p className={styles.hint}>{t('run.fullUnlocksHint')}</p>
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
            {draft.floor}. {t(`floors.${draft.floor}`)}
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
          shortcut="/"
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
          <Button type="submit" disabled={create.isPending}>
            {t('run.save')}
          </Button>
          <Button
            variant="danger"
            disabled={isDraftEmpty(draft)}
            onClick={() => {
              setSubmitted(false);
              clearDraft();
            }}
          >
            {t('run.discard')}
          </Button>
        </div>
      </Panel>
    </form>
  );
}
