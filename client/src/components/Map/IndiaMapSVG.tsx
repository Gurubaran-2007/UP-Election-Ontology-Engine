import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';

const CONFIGURED_STATES: Record<string, { code: string }> = {
    'Uttar Pradesh': { code: 'UP' },
};

const IndiaMapSVG: React.FC = () => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loadMap = async () => {
            if (!svgRef.current || !containerRef.current) return;
            try {
                // We're proxying /api to localhost:3000
                const res = await fetch('/api/up/geo/india');
                if (!res.ok) throw new Error('Failed to load India GeoJSON');
                const geojson = await res.json();

                const container = containerRef.current;
                const width = container.clientWidth || 900;
                const height = container.clientHeight || 500;

                // Clear previous render
                d3.select(svgRef.current).selectAll('*').remove();

                const svg = d3.select(svgRef.current)
                    .attr('width', '100%')
                    .attr('height', '100%')
                    .attr('viewBox', `0 0 ${width} ${height}`);

                const g = svg.append('g');

                // Using standard properties for India GeoJSON
                const projection = d3.geoMercator().fitSize([width, height], geojson);
                const path = d3.geoPath().projection(projection);

                // Zoom functionality
                const zoom = d3.zoom<SVGSVGElement, unknown>()
                    .scaleExtent([1, 8])
                    .on('zoom', (event) => {
                        g.attr('transform', event.transform);
                        g.selectAll('.state-label')
                            .style('font-size', `${Math.max(0.4, 0.7 / Math.sqrt(event.transform.k))}rem`);
                    });
                svg.call(zoom);

                const tooltip = d3.select('#india-map-tooltip-react');

                g.selectAll('path')
                    .data(geojson.features)
                    .enter()
                    .append('path')
                    .attr('d', path as any)
                    .style('fill', (d: any) => CONFIGURED_STATES[d.properties.ST_NM] ? 'rgba(255,153,51,0.25)' : '#1e293b')
                    .style('stroke', '#334155')
                    .style('stroke-width', '0.8px')
                    .style('cursor', (d: any) => CONFIGURED_STATES[d.properties.ST_NM] ? 'pointer' : 'default')
                    .on('mouseover', function (event, d: any) {
                        const name = d.properties.ST_NM;
                        d3.select(this)
                            .transition().duration(120)
                            .style('fill', CONFIGURED_STATES[name] ? 'rgba(255,153,51,0.55)' : '#334155');
                        tooltip
                            .style('opacity', 1)
                            .html(`<strong>${name}</strong>${CONFIGURED_STATES[name] ? '<br><span style="color:#FF9933;font-size:0.75rem;">Click to explore →</span>' : ''}`);
                    })
                    .on('mousemove', function (event) {
                        const svgRect = svgRef.current!.getBoundingClientRect();
                        tooltip
                            .style('left', (event.clientX - svgRect.left + 12) + 'px')
                            .style('top', (event.clientY - svgRect.top - 28) + 'px');
                    })
                    .on('mouseout', function (event, d: any) {
                        d3.select(this)
                            .transition().duration(120)
                            .style('fill', CONFIGURED_STATES[d.properties.ST_NM] ? 'rgba(255,153,51,0.25)' : '#1e293b');
                        tooltip.style('opacity', 0);
                    })
                    .on('click', function (event, d: any) {
                        const name = d.properties.ST_NM;
                        const cfg = CONFIGURED_STATES[name];
                        if (!cfg) {
                            // Show coming soon or similar
                            return;
                        }
                        // Navigate to state drill-down
                        navigate(`/state/${cfg.code}`);
                    });

                // Labels
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
                    .style('fill', (d: any) => CONFIGURED_STATES[d.properties.ST_NM] ? '#fff' : '#64748b')
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

            } catch (error) {
                console.error("Failed to render D3 map:", error);
            }
        };

        loadMap();
    }, [navigate]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div id="india-map-tooltip-react" style={{ position: 'absolute', background: 'rgba(15,23,42,0.95)', color: '#f1f5f9', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s', zIndex: 10 }}></div>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default IndiaMapSVG;
