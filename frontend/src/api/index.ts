import axios from 'axios';
import type { StatusData, DistrictData, StrategyResult, NewsItem } from '../types';

const api = axios.create({ baseURL: '/api' });

export const getStatus = () => api.get<StatusData>('/status').then(r => r.data);

export const getDistrictData = (name: string) =>
  api.get<DistrictData>(`/up/district/${encodeURIComponent(name)}`).then(r => r.data);

export const getUPGeo = () => api.get('/up/geo').then(r => r.data);

export const getIndiaGeo = () => api.get('/up/geo/india').then(r => r.data);

export const getStateDistrictGeo = (stateCode: string) =>
  api.get(`/up/geo/districts/${stateCode}`).then(r => r.data);

export const getUPNews = () => api.get<{ status: string; results: NewsItem[] }>('/up/news').then(r => r.data);

export const getChannelLive = (handle: string) =>
  api.get<{ videoId?: string; embedUrl?: string; channelUrl?: string }>(`/up/channel-live/${encodeURIComponent(handle)}`).then(r => r.data);

export const getRegionDistricts = (regionId: string) =>
  api.get<string[]>(`/up/region/${regionId}/districts`).then(r => r.data);

export const getConstituencies = (district: string) =>
  api.get<string[]>(`/up/district/${encodeURIComponent(district)}/constituencies`).then(r => r.data);

export const getConstituencyAnalysis = (name: string) =>
  api.get(`/up/constituency/${encodeURIComponent(name)}/analysis`).then(r => r.data);

export const getBoothAnalysis = (id: string) =>
  api.get(`/up/booth/${id}/analysis`).then(r => r.data);

export const analyzeStrategy = (title: string, description: string) =>
  api.post<StrategyResult>('/strategy', { title, description }).then(r => r.data);

export const aiSearch = (query: string) =>
  api.post<{ result: string }>('/search', { query }).then(r => r.data);

export const getUPDashboard = () => api.get('/up/schemes').then(r => r.data);

export const getUPWeather = () => api.get('/up/weather').then(r => r.data);
