export interface VenuePreset {
  id: string;
  name: string;
  description: string;
  center: [number, number]; // Coordinates
  zoom: number;
  // Bounding box
  bbox: [number, number, number, number];
}

export const VENUES: Record<string, VenuePreset> = {
  mg_road_bangalore: {
    id: 'mg_road_bangalore',
    name: 'MG Road, Bangalore',
    description: 'Commercial hub — Brigade Road to Trinity Circle',
    center: [77.6076, 12.9752],
    zoom: 15.5,
    bbox: [12.969, 77.596, 12.982, 77.619],
  },
  times_square: {
    id: 'times_square',
    name: 'Times Square, NYC',
    description: 'Dense pedestrian grid — Broadway & 7th Ave',
    center: [-73.9857, 40.7589],
    zoom: 15.5,
    bbox: [40.754, -73.993, 40.764, -73.978],
  },
  wembley: {
    id: 'wembley',
    name: 'Wembley Stadium, London',
    description: 'Post-match crowd dispersal to tube stations',
    center: [-0.2796, 51.5560],
    zoom: 15,
    bbox: [51.549, -0.290, 51.563, -0.270],
  },
  connaught_place: {
    id: 'connaught_place',
    name: 'Connaught Place, New Delhi',
    description: 'Circular commercial district with radial roads',
    center: [77.2167, 28.6315],
    zoom: 15,
    bbox: [28.624, 77.209, 28.639, 77.225],
  },
  cst_mumbai: {
    id: 'cst_mumbai',
    name: 'CST Station, Mumbai',
    description: 'Railway terminus evacuation scenario',
    center: [72.8356, 18.9400],
    zoom: 15.5,
    bbox: [18.933, 72.828, 18.947, 72.843],
  },
};
