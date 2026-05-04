"""Convert Datameet maps-master shapefiles to GeoJSON for the frontend.

Usage:
    .venv/bin/python scripts/convert_shapefiles.py [--tolerance 0.05]

Input:  maps-master.zip (must be in project root or ../political_ontology/)
Output: public/maps/india_states.geojson
"""
import argparse
import json
import os
import sys
import zipfile

try:
    import shapefile
    from shapely.geometry import shape, mapping
except ImportError:
    print("Missing deps. Run: .venv/bin/pip install pyshp shapely")
    sys.exit(1)

PROJECT_ROOT = os.path.join(os.path.dirname(__file__), '..')
ZIP_CANDIDATES = [
    os.path.join(PROJECT_ROOT, 'maps-master.zip'),
    os.path.join(PROJECT_ROOT, '..', 'maps-master.zip'),
]
OUT_DIR = os.path.join(PROJECT_ROOT, 'public', 'maps')


def find_zip():
    for p in ZIP_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def extract_shapefile(zip_path, prefix, tmp_dir):
    """Extract all files matching prefix from zip into tmp_dir."""
    os.makedirs(tmp_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            if prefix in name:
                z.extract(name, tmp_dir)
    # Return path to the .shp file
    for root, _, files in os.walk(tmp_dir):
        for f in files:
            if f.endswith('.shp') and prefix.split('/')[-1].split('.')[0] in f:
                return os.path.join(root, f)
    return None


def shp_to_geojson(shp_path, tolerance=0.05):
    sf = shapefile.Reader(shp_path)
    fields = [f[0] for f in sf.fields[1:]]
    features = []
    for sr in sf.shapeRecords():
        props = dict(zip(fields, sr.record))
        geom = shape(sr.shape.__geo_interface__)
        simplified = geom.simplify(tolerance, preserve_topology=True)
        features.append({
            'type': 'Feature',
            'properties': props,
            'geometry': mapping(simplified),
        })
    return {'type': 'FeatureCollection', 'features': features}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tolerance', type=float, default=0.05,
                        help='Simplification tolerance in degrees (default 0.05 ≈ 5km)')
    args = parser.parse_args()

    zip_path = find_zip()
    if not zip_path:
        print(f"maps-master.zip not found. Expected at: {ZIP_CANDIDATES[0]}")
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"Using: {zip_path}")
    print(f"Tolerance: {args.tolerance}°")

    # India states
    print("\n[1/1] Converting India states (Admin2.shp)...")
    shp_path = extract_shapefile(zip_path, 'States/Admin2', '/tmp/shp_states')
    if not shp_path:
        print("  ✗ Admin2.shp not found in zip")
        sys.exit(1)

    geo = shp_to_geojson(shp_path, args.tolerance)
    out = os.path.join(OUT_DIR, 'india_states.geojson')
    with open(out, 'w') as f:
        json.dump(geo, f, separators=(',', ':'))
    size_kb = os.path.getsize(out) / 1024
    print(f"  ✓ {len(geo['features'])} states → {out} ({size_kb:.0f} KB)")

    print("\nDone. Serve via GET /api/up/geo/india")


if __name__ == '__main__':
    main()
