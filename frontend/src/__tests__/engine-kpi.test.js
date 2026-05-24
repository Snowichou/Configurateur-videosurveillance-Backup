// src/__tests__/engine-kpi.test.js
import { describe, it, expect } from 'vitest';
import { kpiConfigSnapshotPure } from '../engine/kpi.js';

const baseProj = {
  projectName: 'TestProj',
  totalCameras: 4,
  totalInMbps: 12.5,
  requiredTB: 2.1,
  nvrPick: { nvr: { id: 'nvr1', name: 'NVR Pro' } },
  switches: { required: true, portsNeeded: 8, totalPorts: 8 },
  storageParams: { daysRetention: 30, hoursPerDay: 24, codec: 'H265', ips: 25, mode: 'continuous', overheadPct: 10 },
  perCamera: [
    { cameraId: 'cam1', cameraName: 'Dome', qty: 2, mbpsPerCam: 2, mbpsLine: 4, mbpsSource: 'manual' },
    { cameraId: 'cam2', cameraName: 'Bullet', qty: 2, mbpsPerCam: 2.25, mbpsLine: 4.5, mbpsSource: 'auto' },
  ],
};

const MODEL = {
  projectName: 'FallbackName',
  recording: { daysRetention: 7, hoursPerDay: 12, codec: 'H264', fps: 15, mode: 'motion', overheadPct: 5 },
  complements: {
    screen: { enabled: true, qty: 2 },
    enclosure: { enabled: false, qty: 1 },
    signage: { enabled: true, qty: 3, scope: 'indoor' },
  },
};

describe('kpiConfigSnapshotPure', () => {
  it('retourne projectName depuis proj', () => {
    const r = kpiConfigSnapshotPure(baseProj, { MODEL });
    expect(r.projectName).toBe('TestProj');
  });

  it('retourne null si proj.projectName vide (not undefined — ?? ne déclenche pas)', () => {
    // ?? ne fait pas fallback sur '', seulement sur null/undefined
    const r = kpiConfigSnapshotPure({ ...baseProj, projectName: '' }, { MODEL });
    expect(r.projectName).toBeNull();
  });

  it('utilise MODEL.projectName si proj.projectName est undefined', () => {
    const { projectName: _, ...projNoName } = baseProj;
    const r = kpiConfigSnapshotPure(projNoName, { MODEL });
    expect(r.projectName).toBe('FallbackName');
  });

  it('retourne totalCameras / totalInMbps / requiredTB', () => {
    const r = kpiConfigSnapshotPure(baseProj, { MODEL });
    expect(r.totalCameras).toBe(4);
    expect(r.totalInMbps).toBe(12.5);
    expect(r.requiredTB).toBe(2.1);
  });

  it('retourne nvrId / nvrName', () => {
    const r = kpiConfigSnapshotPure(baseProj, { MODEL });
    expect(r.nvrId).toBe('nvr1');
    expect(r.nvrName).toBe('NVR Pro');
  });

  it('retourne switchesRequired + ports', () => {
    const r = kpiConfigSnapshotPure(baseProj, { MODEL });
    expect(r.switchesRequired).toBe(true);
    expect(r.switchesPortsNeeded).toBe(8);
    expect(r.switchesTotalPorts).toBe(8);
  });

  it('recording depuis storageParams (priorité sur MODEL.recording)', () => {
    const r = kpiConfigSnapshotPure(baseProj, { MODEL });
    expect(r.recording.daysRetention).toBe(30);
    expect(r.recording.hoursPerDay).toBe(24);
    expect(r.recording.codec).toBe('H265');
    expect(r.recording.fps).toBe(25);   // storageParams.ips
    expect(r.recording.mode).toBe('continuous');
  });

  it('recording fallback sur MODEL.recording si storageParams vide', () => {
    const r = kpiConfigSnapshotPure({ ...baseProj, storageParams: {} }, { MODEL });
    expect(r.recording.daysRetention).toBe(7);
    expect(r.recording.codec).toBe('H264');
  });

  it('camerasTop trié par qty desc, max 30', () => {
    const proj = { ...baseProj, perCamera: [
      { cameraId: 'c1', cameraName: 'A', qty: 1, mbpsPerCam: 2, mbpsLine: 2, mbpsSource: 'auto' },
      { cameraId: 'c2', cameraName: 'B', qty: 5, mbpsPerCam: 2, mbpsLine: 10, mbpsSource: 'auto' },
      { cameraId: 'c3', cameraName: 'C', qty: 3, mbpsPerCam: 2, mbpsLine: 6, mbpsSource: 'auto' },
    ]};
    const r = kpiConfigSnapshotPure(proj, { MODEL });
    expect(r.camerasTop).toHaveLength(3);
    expect(r.camerasTop[0].id).toBe('c2'); // qty=5 en tête
    expect(r.camerasTop[1].id).toBe('c3'); // qty=3
    expect(r.camerasTop[2].id).toBe('c1'); // qty=1
    expect(r.camerasTop.every(c => c.qty > 0)).toBe(true);
  });

  it('filtre les caméras sans id ou qty=0', () => {
    const proj = { ...baseProj, perCamera: [
      { cameraId: '', cameraName: 'X', qty: 2 },
      { cameraId: 'c1', cameraName: 'Y', qty: 0 },
      { cameraId: 'c2', cameraName: 'Z', qty: 1 },
    ]};
    const r = kpiConfigSnapshotPure(proj, { MODEL });
    expect(r.camerasTop).toHaveLength(1);
    expect(r.camerasTop[0].id).toBe('c2');
  });

  it('complements.screen enabled=true avec qty et id via dep', () => {
    const getSelectedOrRecommendedScreen = () => ({ selected: { id: 's1', name: 'Screen 27' } });
    const r = kpiConfigSnapshotPure(baseProj, { MODEL, getSelectedOrRecommendedScreen });
    expect(r.complements.screen.enabled).toBe(true);
    expect(r.complements.screen.qty).toBe(2);
    expect(r.complements.screen.id).toBe('s1');
    expect(r.complements.screen.name).toBe('Screen 27');
  });

  it('complements.enclosure disabled -> qty=0 id=null', () => {
    const r = kpiConfigSnapshotPure(baseProj, { MODEL });
    expect(r.complements.enclosure.enabled).toBe(false);
    expect(r.complements.enclosure.qty).toBe(0);
    expect(r.complements.enclosure.id).toBeNull();
  });

  it('complements.signage enabled avec scope', () => {
    const getSelectedOrRecommendedSign = () => ({ sign: { id: 'sig1', name: 'LED Panel' } });
    const r = kpiConfigSnapshotPure(baseProj, { MODEL, getSelectedOrRecommendedSign });
    expect(r.complements.signage.enabled).toBe(true);
    expect(r.complements.signage.scope).toBe('indoor');
    expect(r.complements.signage.id).toBe('sig1');
  });

  it('retourne { error } si proj invalide provoque exception', () => {
    // On force une exception en passant un proxy qui explose sur accès
    const badProj = new Proxy({}, { get() { throw new Error('boom'); } });
    const r = kpiConfigSnapshotPure(badProj, { MODEL });
    expect(r).toEqual({ error: 'snapshot_failed' });
  });

  it('proj=null retourne snapshot vide cohérent', () => {
    const r = kpiConfigSnapshotPure(null, { MODEL });
    expect(r.totalCameras).toBe(0);
    expect(r.camerasTop).toHaveLength(0);
    expect(r.nvrId).toBeNull();
  });

  it('fonctionne sans aucune dep (MODEL vide)', () => {
    const r = kpiConfigSnapshotPure(baseProj, {});
    expect(r.projectName).toBe('TestProj');
    expect(typeof r.totalCameras).toBe('number');
    expect(r.complements.screen.enabled).toBe(false);
  });
});
