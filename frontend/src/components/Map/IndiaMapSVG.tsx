import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { CONFIGURED_STATES } from '../../types';

interface Props {
  onStateClick: (code: string) => void;
}

const IndiaMapSVG: React.FC<Props> = ({ onStateClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMap = async () => {
      if (!svgRef.current || !containerRef.current) return;
      try {
        const res = await fetch('/api/up/geo/india');
        if (!res.ok) throw new Error('Failed to load India GeoJSON');
        const geojson = await res.json();

        const container = containerRef.current;
        const width = container.clientWidth || 900;
        const height = container.clientHeight || 500;

        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current)
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('viewBox', `0 0 ${width} ${height}`)
          .style('background', '#f8fafc');

        const g = svg.append('g');

        const projection = d3.geoMercator().fitSize([width, height], geojson);
        const path = d3.geoPath().projection(projection);

        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([1, 8])
          .on('zoom', (event) => {
            g.attr('transform', event.transform);
            g.selectAll('.state-label')
              .style('font-size', `${Math.max(0.4, 0.7 / Math.sqrt(event.transform.k))}rem`);
          });
        svg.call(zoom);

        const tooltip = d3.select('#india-map-tooltip');

        g.selectAll('path')
          .data(geojson.features)
          .enter()
          .append('path')
          .attr('d', path as any)
          .style('fill', (d: any) =>
            CONFIGURED_STATES[d.properties.ST_NM] ? 'rgba(249,115,22,0.2)' : '#e2e8f0'
          )
          .style('stroke', '#94a3b8')
          .style('stroke-width', '0.8px')
          .style('cursor', (d: any) =>
            CONFIGURED_STATES[d.properties.ST_NM] ? 'pointer' : 'default'
          )
          .on('mouseover', function (event, d: any) {
            const name = d.properties.ST_NM;
            d3.select(this)
              .transition().duration(120)
              .style('fill', CONFIGURED_STATES[name]
                ? 'rgba(249,115,22,0.5)'
                : '#cbd5e1'
              );
            tooltip
              .style('opacity', 1)
              .html(`<strong>${name}</strong>${CONFIGURED_STATES[name]
                ? '<br><span style="color:#f97316;font-size:0.75rem;">Click to explore →</span>'
                : ''
              }`);
          })
          .on('mousemove', function (event) {
            const svgRect = svgRef.current!.getBoundingClientRect();
            tooltip
              .style('left', (event.clientX - svgRect.left + 12) + 'px')
              .style('top', (event.clientY - svgRect.top - 28) + 'px');
          })
          .on('mouseout', function (_, d: any) {
            d3.select(this)
              .transition().duration(120)
              .style('fill', CONFIGURED_STATES[d.properties.ST_NM]
                ? 'rgba(249,115,22,0.2)'
                : '#e2e8f0'
              );
            tooltip.style('opacity', 0);
          })
          .on('click', function (_, d: any) {
            const name = d.properties.ST_NM;
            const cfg = CONFIGURED_STATES[name];
            if (cfg) onStateClick(cfg.code);
          });

        g.selectAll('.state-label')
          .data(geojson.features)
          .enter()
          .append('text')
          .attr('class', 'state-label')
          .attr('x', (d: any) => path.centroid(d)[0])
          .attr('y', (d: any) => path.centroid(d)[1])
          .attr('text-anchor', 'middle')
          .attr('dy', '.35em')
          .style('pointer-events', 'none')
          .style('font-size', '0.6rem')
          .style('font-weight', '600')
          .style('fill', (d: any) =>
            CONFIGURED_STATES[d.properties.ST_NM] ? '#7c2d12' : '#94a3b8'
          )
          .text((d: any) => {
            const name = d.properties.ST_NM;
            const abbr: Record<string, string> = {
              'Arunachal Pradesh': 'AR', 'Andaman & Nicobar': 'A&N',
              'Dadra and Nagar Haveli and Daman and Diu': 'DNHDD',
              'Jammu & Kashmir': 'J&K', 'Himachal Pradesh': 'HP',
              'Madhya Pradesh': 'MP', 'Uttar Pradesh': 'UP',
              'Andhra Pradesh': 'AP', 'West Bengal': 'WB',
            };
            return abbr[name] || name.split(' ').map((w: string) => w[0]).join('').slice(0, 3);
          });

      } catch (err) {
        console.error('[IndiaMapSVG] Failed to render:', err);
      }
    };

    loadMap();
  }, [onStateClick]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        id="india-map-tooltip"
        style={{
          position: 'absolute',
          background: 'rgba(255,255,255,0.97)',
          color: '#1e293b',
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(249,115,22,0.4)',
          fontSize: '0.82rem',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.15s',
          zIndex: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}
      />
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default IndiaMapSVG;
