import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { GitCompare, Bookmark, Check } from 'lucide-react';
import type { TestResult } from '../../types';
import type { StationarityResult } from '../../store/api';
import { addPinnedItem } from '../../store/slices/pinnedNotesSlice';

export function HypothesisTestResults(props: {
  result: TestResult;
  config: Record<string, string>;
}) {
  const { result, config } = props;
  const dispatch = useDispatch();
  const [pinned, setPinned] = useState(false);

  const handlePin = () => {
    dispatch(
      addPinnedItem({
        title: `${result.test} (${config.value_col || config.col1 || 'Variables'})`,
        category: 'test',
        badge: `p = ${result.p_value < 0.0001 ? '< 0.0001' : result.p_value.toFixed(4)} (${result.significant ? 'H₀ rejetée' : 'H₀ non rejetée'})`,
        details: `Statistique: ${result.statistic.toFixed(4)} | Interprétation: ${result.interpretation || 'N/A'}`,
      })
    );
    setPinned(true);
    setTimeout(() => setPinned(false), 2000);
  };

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span className="flex items-center gap-2" style={{ color: 'var(--ui-text)' }}>
            <GitCompare className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
            <span>{result.test}</span>
            <span className={result.significant ? 'ui-tag ui-tag-ok' : 'ui-tag ui-tag-neutral'}>
              {result.significant ? 'Significatif' : 'Non significatif'}
            </span>
          </span>
          <button
            onClick={handlePin}
            className="ui-btn ui-focusable text-xs"
            title="Épingler ce résultat au carnet de bord"
          >
            {pinned ? <Check className="w-3.5 h-3.5 ui-t-success" /> : <Bookmark className="w-3.5 h-3.5" />}
            {pinned ? 'Épinglé' : 'Épingler'}
          </button>
        </header>

        <div className="overflow-x-auto">
          <table className="ui-table w-full text-xs">
            <thead>
              <tr>
                <th className="ui-th-num">Statistique</th>
                <th className="ui-th-num">p-value</th>
                <th className="ui-th-num">Seuil α</th>
                <th className="text-left">Décision</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="ui-td-num font-bold">{result.statistic.toFixed(4)}</td>
                <td className="ui-td-num font-bold" style={{ color: result.p_value < 0.05 ? 'var(--ui-success)' : undefined }}>
                  {result.p_value < 0.0001 ? '< 0.0001' : result.p_value.toFixed(4)}
                </td>
                <td className="ui-td-num">0.05</td>
                <td className="font-semibold" style={{ color: result.significant ? 'var(--ui-success)' : 'var(--ui-warning)' }}>
                  {result.significant ? 'H₀ rejetée' : 'H₀ non rejetée'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {result.effect_size && Object.keys(result.effect_size).length > 0 && (
          <div className="px-3 py-2 flex flex-wrap items-center gap-2" style={{ borderTop: '1px solid var(--ui-border)' }}>
            <span className="ui-label">Taille d&apos;effet</span>
            {Object.entries(result.effect_size).map(([key, val]) => (
              <span key={key} className="ui-tag ui-tag-accent ui-num">
                {key} = {typeof val === 'number' ? val.toFixed(4) : String(val)}
              </span>
            ))}
          </div>
        )}

        {result.interpretation && (
          <div
            className="px-3 py-2 text-xs ui-t-secondary"
            style={{ borderTop: '1px solid var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
          >
            <strong style={{ color: 'var(--ui-accent-text)' }}>Interprétation :</strong> {result.interpretation}
          </div>
        )}
      </section>
    </div>
  );
}

export function StationarityBadge(props: {
  summary: string;
  orders: Record<
    string,
    { order: number; is_stationary: boolean; adf_p: number | null; kpss_p: number | null }
  >;
  cointegrationLikely: boolean;
  configCol?: string;
}) {
  const entries = Object.entries(props.orders);

  const metaMap: Record<string, { tag: string; icon: string; title: string; rec: string }> = {
    all_stationary: {
      tag: 'ui-tag ui-tag-ok',
      icon: 'OK',
      title: 'Séries stationnaires I(0)',
      rec: 'VAR en niveaux / ARIMA d=0.',
    },
    all_nonstationary: {
      tag: props.cointegrationLikely ? 'ui-tag ui-tag-info' : 'ui-tag ui-tag-warning',
      icon: props.cointegrationLikely ? 'COI' : 'WARN',
      title: props.cointegrationLikely
        ? `${entries.length} séries I(1) — cointégration probable`
        : 'Séries non-stationnaires I(1)',
      rec: props.cointegrationLikely ? 'VECM recommandé.' : 'ARIMA d=1 / VAR en différences.',
    },
    mixed: {
      tag: 'ui-tag ui-tag-info',
      icon: '≈',
      title: 'Stationnarité mixte I(0)/I(1)',
      rec: 'ARDL recommandé.',
    },
  };

  const meta = metaMap[props.summary] ?? metaMap.all_nonstationary;
  const focusCol = props.configCol && props.orders[props.configCol];

  return (
    <div className="ui-panel p-2.5 space-y-1.5" style={{ background: 'var(--ui-bg-sunken)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={meta.tag}>{meta.icon}</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>{meta.title}</span>
        <span className="text-xs ui-t-muted">— {meta.rec}</span>
      </div>

      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1 ui-num">
          {entries.slice(0, 6).map(([col, info]) => (
            <span
              key={col}
              className={`ui-tag ${
                info.order === 0 ? 'ui-tag-ok' : info.order === 1 ? 'ui-tag-warning' : 'ui-tag-danger'
              }`}
              style={col === props.configCol ? { borderColor: 'var(--ui-accent)' } : undefined}
            >
              {col} I({info.order})
              {info.adf_p !== null && <span className="ml-1 opacity-75">p={info.adf_p?.toFixed(3)}</span>}
            </span>
          ))}
        </div>
      )}

      {focusCol && (
        <p className="text-xs ui-num" style={{ color: focusCol.order > 0 ? 'var(--ui-warning)' : 'var(--ui-success)' }}>
          <strong>{props.configCol}</strong> :{' '}
          {focusCol.order === 0
            ? 'stationnaire (d=0).'
            : `non-stationnaire I(${focusCol.order}) — ${focusCol.order} différenciation(s).`}
        </p>
      )}
    </div>
  );
}

function TestResultRow(props: {
  name: string;
  data: any;
  h0: string;
  nObs: number;
}) {
  const fmtVal = (v: number | undefined) => (v !== undefined ? v.toFixed(4) : '—');
  const { name, data, h0, nObs } = props;
  if (!data || data.error) {
    return (
      <tr>
        <td className="font-semibold">{name}</td>
        <td colSpan={5} className="ui-t-danger">{data?.error ?? 'Erreur inconnue'}</td>
      </tr>
    );
  }
  return (
    <tr>
      <td>
        <div className="font-semibold" style={{ color: 'var(--ui-text)' }}>{name}</div>
        <div className="text-[11px] ui-t-faint">H₀ : {h0}</div>
      </td>
      <td className="ui-td-num font-bold">{fmtVal(data.statistic)}</td>
      <td className="ui-td-num font-bold" style={{ color: data.is_stationary ? 'var(--ui-success)' : 'var(--ui-warning)' }}>
        {data.p_value < 0.0001 ? '< 0.0001' : fmtVal(data.p_value)}
      </td>
      <td className="ui-td-num">{data.lags_used ?? '—'}</td>
      <td className="ui-td-num">{data.n_obs ?? nObs}</td>
      <td>
        <span className={data.is_stationary ? 'ui-tag ui-tag-ok' : 'ui-tag ui-tag-warning'}>
          {data.interpretation}
        </span>
      </td>
    </tr>
  );
}

export function StationarityResults({ result }: { result: StationarityResult }) {
  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span className="flex items-center gap-2" style={{ color: 'var(--ui-text)' }}>
            <span className={result.is_stationary ? 'ui-tag ui-tag-ok' : 'ui-tag ui-tag-warning'}>
              {result.is_stationary ? 'Stationnaire' : 'Non-stationnaire'}
            </span>
            <span>{result.column}</span>
          </span>
          <span className="ui-num text-xs ui-t-muted">{result.n_obs.toLocaleString('fr-FR')} obs.</span>
        </header>

        <div className="overflow-x-auto">
          <table className="ui-table w-full text-xs">
            <thead>
              <tr>
                <th className="text-left">Test</th>
                <th className="ui-th-num">Statistique</th>
                <th className="ui-th-num">p-value</th>
                <th className="ui-th-num">Lags</th>
                <th className="ui-th-num">n</th>
                <th className="text-left">Verdict</th>
              </tr>
            </thead>
            <tbody>
              <TestResultRow
                name="ADF (Augmented Dickey-Fuller)"
                data={result.adf}
                h0="Racine unitaire (non-stationnaire)"
                nObs={result.n_obs}
              />
              <TestResultRow
                name="KPSS (Kwiatkowski-Phillips-Schmidt-Shin)"
                data={result.kpss}
                h0="Série stationnaire"
                nObs={result.n_obs}
              />
            </tbody>
          </table>
        </div>

        <div className="px-3 py-2 text-xs ui-t-secondary" style={{ borderTop: '1px solid var(--ui-border)' }}>
          {result.conclusion}
        </div>
      </section>
    </div>
  );
}
