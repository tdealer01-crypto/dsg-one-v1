import { describe, expect, it } from 'vitest';
import {
  deriveAimoServiceToken,
  getAimoServiceConfig,
  getAimoServiceReadiness,
  isAimoControlPlaneTokenAuthorized,
} from '../../lib/dsg/aimo/service-registry';

describe('DSG AIMO service registry', () => {
  it('uses one URL registry while keeping the canonical Control Plane API key explicit', () => {
    const env = {
      NODE_ENV: 'test',
      DSG_AIMO_SERVICE_REGISTRY: JSON.stringify({
        simulationUrl: 'https://simulation.example.test',
        cinemaUrl: 'https://cinema.example.test',
        controlPlaneUrl: 'https://control-plane.example.test',
        maxParallelism: 12,
      }),
      DSG_AIMO_ROOT_KEY: 'root-secret-for-test',
      DSG_CONTROL_PLANE_API_KEY: 'persisted-dsg-api-key',
    } as NodeJS.ProcessEnv;

    const config = getAimoServiceConfig(env);
    expect(config.mode).toBe('registry');
    expect(config.simulationUrl).toBe('https://simulation.example.test');
    expect(config.cinemaUrl).toBe('https://cinema.example.test');
    expect(config.controlPlaneUrl).toBe('https://control-plane.example.test');
    expect(config.controlPlaneApiKey).toBe('persisted-dsg-api-key');
    expect(config.maxParallelism).toBe(12);
    expect(config.simulationApiKey).toBe(
      deriveAimoServiceToken('root-secret-for-test', 'simulation'),
    );
    expect(config.cinemaApiKey).toBe(
      deriveAimoServiceToken('root-secret-for-test', 'cinema'),
    );
    expect(config.controlPlaneApiKey).not.toBe(
      deriveAimoServiceToken('root-secret-for-test', 'control-plane'),
    );
    expect(config.simulationApiKey).not.toBe(config.cinemaApiKey);
    expect(config.simulationApiKey).not.toContain('root-secret-for-test');

    const readiness = getAimoServiceReadiness(env);
    expect(readiness.ready).toBe(true);
    expect(readiness.controlPlaneConfigured).toBe(true);
  });

  it('retains the internal derived control-plane token helper without treating it as DSG API auth', () => {
    const env = {
      NODE_ENV: 'test',
      DSG_AIMO_ROOT_KEY: 'root-secret-for-test',
    } as NodeJS.ProcessEnv;
    const token = deriveAimoServiceToken('root-secret-for-test', 'control-plane');

    expect(token).not.toContain('root-secret-for-test');
    expect(token).not.toBe(
      deriveAimoServiceToken('root-secret-for-test', 'simulation'),
    );
    expect(token).not.toBe(
      deriveAimoServiceToken('root-secret-for-test', 'cinema'),
    );
    expect(isAimoControlPlaneTokenAuthorized(token, env)).toBe(true);
    expect(isAimoControlPlaneTokenAuthorized('wrong-token', env)).toBe(false);
    expect(isAimoControlPlaneTokenAuthorized(undefined, env)).toBe(false);
    expect(getAimoServiceConfig(env).controlPlaneApiKey).toBeUndefined();
  });

  it('keeps simulation/cinema service-specific keys as explicit overrides', () => {
    const env = {
      NODE_ENV: 'test',
      DSG_AIMO_SERVICE_REGISTRY: JSON.stringify({
        simulationUrl: 'https://simulation.example.test',
        cinemaUrl: 'https://cinema.example.test',
        controlPlaneUrl: 'https://control-plane.example.test',
      }),
      DSG_AIMO_ROOT_KEY: 'root-secret-for-test',
      DSG_AGI_SIMULATION_API_KEY: 'simulation-override',
      DSG_CINEMA_PROOF_API_KEY: 'cinema-override',
      DSG_CONTROL_PLANE_API_KEY: 'control-plane-api-key',
    } as NodeJS.ProcessEnv;

    const config = getAimoServiceConfig(env);
    expect(config.simulationApiKey).toBe('simulation-override');
    expect(config.cinemaApiKey).toBe('cinema-override');
    expect(config.controlPlaneApiKey).toBe('control-plane-api-key');
  });

  it('supports legacy URL configuration while migration is in progress', () => {
    const config = getAimoServiceConfig({
      NODE_ENV: 'test',
      DSG_AGI_SIMULATION_URL: 'https://legacy-sim.example.test',
      DSG_CINEMA_PROOF_URL: 'https://legacy-cinema.example.test',
      DSG_CONTROL_PLANE_URL: 'https://legacy-control-plane.example.test',
      DSG_AGI_SIMULATION_API_KEY: 'legacy-sim-key',
      DSG_CINEMA_PROOF_API_KEY: 'legacy-cinema-key',
      DSG_CONTROL_PLANE_API_KEY: 'legacy-control-plane-key',
      DSG_AIMO_MAX_PARALLELISM: '20',
    } as NodeJS.ProcessEnv);

    expect(config.mode).toBe('legacy');
    expect(config.simulationUrl).toBe('https://legacy-sim.example.test');
    expect(config.cinemaUrl).toBe('https://legacy-cinema.example.test');
    expect(config.controlPlaneUrl).toBe('https://legacy-control-plane.example.test');
    expect(config.maxParallelism).toBe(20);
  });

  it('reports every missing proof-chain dependency without exposing secret values', () => {
    const readiness = getAimoServiceReadiness({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual([
      'simulationUrl',
      'cinemaUrl',
      'controlPlaneUrl',
      'simulationAuth',
      'cinemaAuth',
      'controlPlaneAuth',
    ]);
    expect(JSON.stringify(readiness)).not.toContain('secret');
  });
});
