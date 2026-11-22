import { pointInRing, polygonRing } from "@/registry/vianova/lib/trip-report";

/**
 * Lisbon's districts, and which one a point falls in.
 *
 * The sample trips feed has carried an origin and a destination all along --
 * the two ends of each route's LINESTRING -- but nothing read past the first
 * vertex, so the dashboard had coordinates and no places. These polygons turn
 * both ends into names, which is what makes an origin-destination chart
 * possible on the data that already ships.
 *
 * Twelve hand-drawn polygons, ten vertices each. Point-in-polygon over that
 * is cheap enough to run per trip per end without a spatial index: a month of
 * the sample feed is a few thousand trips, so a few thousand tests against a
 * few dozen edges, once, when the feed loads.
 */
export type District = {
  id: string;
  name: string;
  areaType: string;
  population: number;
  ring: [number, number][];
};

export function readDistricts({
  header,
  rows,
}: {
  header: string[];
  rows: string[][];
}): District[] {
  const at = (name: string) => header.indexOf(name);
  const c = {
    id: at("district_id"),
    name: at("name"),
    areaType: at("area_type"),
    population: at("population"),
    geometry: at("geometry"),
  };
  if (c.name < 0 || c.geometry < 0) return [];

  const districts: District[] = [];
  for (const row of rows) {
    const name = row[c.name];
    if (!name) continue;
    const ring = polygonRing(row[c.geometry]);
    if (ring.length < 3) continue;
    districts.push({
      id: row[c.id] ?? name,
      name,
      areaType: row[c.areaType] ?? "",
      population: Number(row[c.population]) || 0,
      ring,
    });
  }
  return districts;
}

/**
 * The twelve districts, inlined rather than fetched.
 *
 * `districts-lisbon.csv` is the source and stays the source -- this was
 * generated from it. It is 4KB of coordinates, which is well under the bar
 * the feeds are fetched to stay beneath, and inlining buys something real:
 * assigning a trip to a district is no longer a second async load that every
 * widget reading a district has to wait for and handle the failure of.
 */
export const LISBON_DISTRICTS: District[] = [
  {
    id: "D-01",
    name: "Baixa",
    areaType: "Historic",
    population: 7523,
    ring: [[-9.13419, 38.7139], [-9.13509, 38.71666], [-9.1382, 38.71878], [-9.14186, 38.71736], [-9.14468, 38.71543], [-9.14492, 38.71231], [-9.142, 38.71025], [-9.13836, 38.70976], [-9.13469, 38.71088], [-9.13419, 38.7139]],
  },
  {
    id: "D-02",
    name: "Alfama",
    areaType: "Historic",
    population: 6392,
    ring: [[-9.12483, 38.7125], [-9.12669, 38.71467], [-9.12922, 38.71597], [-9.1322, 38.71548], [-9.13488, 38.71388], [-9.13534, 38.71098], [-9.13225, 38.70946], [-9.12901, 38.70813], [-9.12659, 38.71027], [-9.12483, 38.7125]],
  },
  {
    id: "D-03",
    name: "Chiado",
    areaType: "Historic",
    population: 7535,
    ring: [[-9.1374, 38.7105], [-9.13968, 38.71235], [-9.14185, 38.71339], [-9.14468, 38.71345], [-9.14714, 38.71182], [-9.14648, 38.70937], [-9.1443, 38.70807], [-9.14187, 38.70773], [-9.13918, 38.70832], [-9.1374, 38.7105]],
  },
  {
    id: "D-04",
    name: "Cais do Sodré",
    areaType: "Waterfront",
    population: 6353,
    ring: [[-9.14041, 38.7065], [-9.14034, 38.70889], [-9.14327, 38.70974], [-9.14585, 38.70901], [-9.14738, 38.70746], [-9.14815, 38.70532], [-9.14587, 38.70397], [-9.14335, 38.7036], [-9.14039, 38.70413], [-9.14041, 38.7065]],
  },
  {
    id: "D-05",
    name: "Belém",
    areaType: "Waterfront",
    population: 8741,
    ring: [[-9.19858, 38.697], [-9.20148, 38.69996], [-9.20494, 38.70169], [-9.20946, 38.70167], [-9.21221, 38.69876], [-9.21254, 38.69514], [-9.20894, 38.69303], [-9.20501, 38.69262], [-9.2012, 38.69386], [-9.19858, 38.697]],
  },
  {
    id: "D-06",
    name: "Parque das Nações",
    areaType: "Waterfront",
    population: 12824,
    ring: [[-9.08713, 38.765], [-9.09079, 38.76907], [-9.09517, 38.77312], [-9.10222, 38.77206], [-9.10731, 38.76793], [-9.10599, 38.76245], [-9.1013, 38.75919], [-9.09506, 38.75644], [-9.09023, 38.76057], [-9.08713, 38.765]],
  },
  {
    id: "D-07",
    name: "Avenidas Novas",
    areaType: "Business",
    population: 9922,
    ring: [[-9.13789, 38.736], [-9.14134, 38.73971], [-9.14579, 38.74135], [-9.15078, 38.74111], [-9.15545, 38.7384], [-9.15575, 38.73351], [-9.15115, 38.73039], [-9.14549, 38.7293], [-9.1398, 38.73129], [-9.13789, 38.736]],
  },
  {
    id: "D-08",
    name: "Alvalade",
    areaType: "Residential",
    population: 11782,
    ring: [[-9.13174, 38.753], [-9.13462, 38.75652], [-9.13851, 38.75961], [-9.14413, 38.75858], [-9.14885, 38.75551], [-9.14754, 38.75086], [-9.1439, 38.74772], [-9.1386, 38.74682], [-9.13397, 38.74905], [-9.13174, 38.753]],
  },
  {
    id: "D-09",
    name: "Campo de Ourique",
    areaType: "Residential",
    population: 8157,
    ring: [[-9.15273, 38.714], [-9.15546, 38.71697], [-9.15883, 38.71918], [-9.16357, 38.71883], [-9.1672, 38.71604], [-9.16711, 38.71198], [-9.16388, 38.70876], [-9.15859, 38.70775], [-9.15509, 38.71079], [-9.15273, 38.714]],
  },
  {
    id: "D-10",
    name: "Arroios",
    areaType: "Residential",
    population: 8373,
    ring: [[-9.12982, 38.7285], [-9.13058, 38.7314], [-9.13407, 38.73263], [-9.1377, 38.73215], [-9.14045, 38.73005], [-9.14071, 38.72688], [-9.13809, 38.72432], [-9.1339, 38.72361], [-9.12983, 38.72512], [-9.12982, 38.7285]],
  },
  {
    id: "D-11",
    name: "Lumiar",
    areaType: "Residential",
    population: 12568,
    ring: [[-9.14933, 38.764], [-9.1503, 38.76904], [-9.1566, 38.77021], [-9.16294, 38.77067], [-9.16711, 38.76659], [-9.16532, 38.76192], [-9.16172, 38.75897], [-9.15619, 38.75597], [-9.15106, 38.75946], [-9.14933, 38.764]],
  },
  {
    id: "D-12",
    name: "Alcântara",
    areaType: "Business",
    population: 8331,
    ring: [[-9.1727, 38.7035], [-9.1732, 38.70664], [-9.17718, 38.70715], [-9.18092, 38.70745], [-9.18346, 38.70505], [-9.18221, 38.7023], [-9.18083, 38.69968], [-9.17692, 38.69874], [-9.17444, 38.70117], [-9.1727, 38.7035]],
  },
];

/**
 * A lookup from a point to a district name.
 *
 * Returns a function rather than taking the list every time, so the bounding
 * boxes are computed once. A box test rejects most districts for most points
 * without touching the ring, which is the whole of the optimisation and all
 * it needs.
 */
export function districtLocator(districts: District[]) {
  const boxed = districts.map((d) => {
    const lons = d.ring.map(([lon]) => lon);
    const lats = d.ring.map(([, lat]) => lat);
    return {
      district: d,
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    };
  });

  return (lon: number, lat: number): string | null => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    for (const b of boxed) {
      if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat)
        continue;
      if (pointInRing([lon, lat], b.district.ring)) return b.district.name;
    }
    return null;
  };
}

/**
 * What to call a trip that started or ended outside every district.
 *
 * Named rather than dropped. A flow chart that silently discards its
 * unmatched rows reports a smaller city than the one in the data, and the
 * share that falls outside the drawn districts is itself worth seeing.
 */
export const OUTSIDE = "Outside the city";
