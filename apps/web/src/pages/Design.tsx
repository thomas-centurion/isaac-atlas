import { useState } from 'react';
import { isValidSeedFormat } from '@isaac-atlas/shared';
import { useTranslation } from 'react-i18next';
import { catalog } from '../catalog';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ItemIcon } from '../ui/ItemIcon';
import { Panel } from '../ui/Panel';
import { Tabs } from '../ui/Tabs';
import { TextField } from '../ui/TextField';
import styles from './Design.module.css';

type Sort = 'hot' | 'top' | 'new';

export function Design() {
  const { t } = useTranslation();
  const [seed, setSeed] = useState('');
  const [sort, setSort] = useState<Sort>('hot');
  const seedError = seed && !isValidSeedFormat(seed) ? t('design.seedError') : undefined;

  return (
    <>
      <Panel>
        <h1>{t('design.title')}</h1>
        <p>{t('design.intro')}</p>
      </Panel>

      <div className={styles.grid}>
        <Panel title={t('design.buttons')}>
          <div className={styles.row}>
            <Button>{t('button.primary')}</Button>
            <Button variant="secondary">{t('button.secondary')}</Button>
            <Button variant="danger">{t('button.danger')}</Button>
            <Button disabled>{t('button.primary')}</Button>
          </div>
        </Panel>

        <Panel title={t('design.fields')}>
          <TextField
            label={t('design.seedLabel')}
            placeholder="ABCD 1234"
            hint={t('design.seedHint')}
            error={seedError}
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            maxLength={9}
          />
        </Panel>

        <Panel title={t('design.badges')}>
          <div className={styles.row}>
            <Badge tone="op">{t('verdict.op')}</Badge>
            <Badge tone="troll">{t('verdict.troll')}</Badge>
            <Badge tone="hard">{t('verdict.hard')}</Badge>
            <Badge>Rep+</Badge>
          </div>
        </Panel>

        <Panel title={t('design.tabs')}>
          <Tabs
            label={t('design.tabs')}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'hot', label: t('sort.hot') },
              { value: 'top', label: t('sort.top') },
              { value: 'new', label: t('sort.new') },
            ]}
          />
        </Panel>
      </div>

      <Panel title={t('design.items')}>
        <div className={styles.icons}>
          {catalog.items.slice(0, 60).map((item) => (
            <ItemIcon key={item.id} kind="item" id={item.id} />
          ))}
        </div>
      </Panel>

      <Panel title={t('design.trinkets')}>
        <div className={styles.icons}>
          {catalog.trinkets.slice(0, 20).map((trinket) => (
            <ItemIcon key={trinket.id} kind="trinket" id={trinket.id} />
          ))}
        </div>
      </Panel>
    </>
  );
}
