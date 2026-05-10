import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  stateCode: string;
  onDistrictClick: (districtName: string) => void;
  selectedDistrict: string | null;
}

const REGIONS: Record<string, { color: string; districts: string[] }> = {
  'Western U.P.': {
    color: '#d4a017',
    districts: ['Saharanpur', 'Muzaffarnagar', 'Shamli', 'Baghpat', 'Meerut', 'Ghaziabad', 'Hapur', 'Gautam Buddha Nagar', 'Bulandshahr', 'Aligarh', 'Hathras', 'Mathura', 'Agra', 'Firozabad', 'Etah', 'Kasganj', 'Mainpuri', 'Etawah', 'Auraiya', 'Kannauj', 'Farrukhabad'],
  },
  'Rohilkhand': {
    color: '#3b82f6',
    districts: ['Bijnor', 'Amroha', 'Moradabad', 'Rampur', 'Sambhal', 'Budaun', 'Bareilly', 'Pilibhit', 'Shahjahanpur'],
  },
  'Awadh': {
    color: '#8b5cf6',
    districts: ['Kheri', 'Sitapur', 'Hardoi', 'Unnao', 'Lucknow', 'Rae Bareli', 'Barabanki', 'Ayodhya', 'Amethi', 'Sultanpur', 'Ambedkar Nagar', 'Gonda', 'Bahraich', 'Shravasti', 'Balrampur', 'Fatehpur'],
  },
  'Bundelkhand': {
    color: '#ef4444',
    districts: ['Jalaun', 'Jhansi', 'Lalitpur', 'Hamirpur', 'Mahoba', 'Banda', 'Chitrakoot'],
  },
  'Purvanchal': {
    color: '#22c55e',
    districts: ['Siddharthnagar', 'Maharajganj', 'Kushinagar', 'Basti', 'Sant Kabir Nagar', 'Gorakhpur', 'Deoria', 'Azamgarh', 'Mau', 'Ballia', 'Jaunpur', 'Ghazipur', 'Varanasi', 'Sant Ravidas Nagar', 'Mirzapur', 'Chandauli', 'Sonbhadra', 'Prayagraj', 'Kaushambi', 'Pratapgarh'],
  },
};

function getDistrictRegion(name: string) {
  const n = name.trim();
  for (const [region, data] of Object.entries(REGIONS)) {
    if (data.districts.some(d => n.includes(d) || d.includes(n))) {
      return { region, color: data.color };
    }
  }
  return { region: 'Other', color: '#64748b' };
}

const GEO_ENDPOINTS: Record<string, string> = {
  UP: '/api/up/geo',
};

const StateMapSVG: React.FC<Props> = ({ stateCode, onDistrictClick, selectedDistrict }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastSelectedRef = useRef<d3.Selection<SVGPathElement, any, any, any> | null>(null);

  useEffect(() => {
    const loadMap = async () => {
      if (!svgRef.current || !containerRef.current) return;
      const endpoint = GEO_ENDPOINTS[stateCode];
      if (!endpoint) return;

      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const geojson = await res.json();
        if (!geojson.features?.length) throw new Error('No district data');

        const container = containerRef.current!;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 700;

        d3.select(svgRef.current).selectAll('*').remove();

        const svg = d3.select(svgRef.current)
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('viewBox', `0 0 ${width} ${height}`)
          .style('background', '#f8fafc');

        const mainGroup = svg.append('g');
        const pathGroup = mainGroup.append('g').attr('class', 'path-layer');
        const labelGroup = mainGroup.append('g').attr('class', 'label-layer');

        const projection = d3.geoIdentity().reflectY(true).fitSize([width, height], geojson);
        const pathGen = d3.geoPath().projection(projection);

        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([1, 15])
          .on('zoom', (event) => {
            mainGroup.attr('transform', event.transform);
            labelGroup.selectAll('.district-label')
              .style('font-size', `${Math.max(0.3, 0.65 / Math.sqrt(event.transform.k))}rem`)
              .style('stroke-width', `${0.2 / event.transform.k}px`);
            labelGroup.selectAll('.region-label')
              .style('font-size', `${1.6 / Math.sqrt(event.transform.k)}rem`)
              .style('opacity', event.transform.k > 3 ? 0 : 0.3);
          });
        svg.call(zoom);

        const regionLabels = [
          { text: 'Western U.P.', x: width * 0.15, y: height * 0.55 },
          { text: 'Rohilkhand',   x: width * 0.40, y: height * 0.10 },
          { text: 'Awadh',        x: width * 0.60, y: height * 0.30 },
          { text: 'Bundelkhand',  x: width * 0.35, y: height * 0.82 },
          { text: 'Purvanchal',   x: width * 0.85, y: height * 0.78 },
        ];

        pathGroup.selectAll<SVGPathElement, any>('path')
          .data(geojson.features)
          .enter()
          .append('path')
          .attr('d', pathGen as any)
          .style('fill', (d: any) => {
            const name = d.properties.name || '';
            return getDistrictRegion(name).color + '44';
          })
          .style('stroke', '#94a3b8')
          .style('stroke-width', '0.5px')
          .style('cursor', 'pointer')
          .on('mouseover', function (_, d: any) {
            const name = d.properties.name || '';
            const isSelected = selectedDistrict === name;
            if (!isSelected) {
              d3.select(this).transition().duration(150)
                .style('fill', 'rgba(249,115,22,0.45)')
                .style('stroke', '#f97316')
                .style('stroke-width', '1.5px');
            }
          })
          .on('mouseout', function (_, d: any) {
            const name = d.properties.name || '';
            const isSelected = selectedDistrict === name;
            if (!isSelected) {
              d3.select(this).transition().duration(150)
                .style('fill', getDistrictRegion(name).color + '44')
                .style('stroke', '#94a3b8')
                .style('stroke-width', '0.5px');
            }
          })
          .on('click', function (_, d: any) {
            const name = d.properties.name || 'Unknown';

            if (lastSelectedRef.current) {
              const prevData = lastSelectedRef.current.datum() as any;
              const prevName = prevData?.properties?.name || '';
              lastSelectedRef.current
                .style('stroke', '#94a3b8')
                .style('stroke-width', '0.5px')
                .style('fill', getDistrictRegion(prevName).color + '44');
            }

            const sel = d3.select<SVGPathElement, any>(this)
              .style('stroke', '#f97316')
              .style('stroke-width', '2.5px')
              .style('fill', 'rgba(249,115,22,0.35)');
            lastSelectedRef.current = sel;

            onDistrictClick(name);
          });

        labelGroup.selectAll('.region-label')
          .data(regionLabels)
          .enter()
          .append('text')
          .attr('class', 'region-label')
          .attr('x', d => d.x)
          .attr('y', d => d.y)
          .attr('text-anchor', 'middle')
          .style('font-size', '1.6rem')
          .style('font-weight', '900')
          .style('fill', 'rgba(15,23,42,0.18)')
          .style('font-family', 'Outfit, Inter, sans-serif')
          .style('pointer-events', 'none')
          .style('text-transform', 'uppercase')
          .text(d => d.text);

        labelGroup.selectAll('.district-label')
          .data(geojson.features)
          .enter()
          .append('text')
          .attr('class', 'district-label')
          .attr('x', (d: any) => pathGen.centroid(d)[0] || 0)
          .attr('y', (d: any) => pathGen.centroid(d)[1] || 0)
          .attr('text-anchor', 'middle')
          .attr('dy', '.35em')
          .style('pointer-events', 'none')
          .style('font-size', '0.55rem')
          .style('font-weight', '700')
          .style('fill', '#1e293b')
          .style('text-transform', 'uppercase')
          .style('paint-order', 'stroke')
          .style('stroke', 'rgba(248,250,252,0.8)')
          .style('stroke-width', '0.25px')
          .text((d: any) => d.properties.name || '');

      } catch (err: any) {
        console.error('[StateMapSVG] Failed:', err.message);
      }
    };

    loadMap();
  }, [stateCode]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default StateMapSVG;
