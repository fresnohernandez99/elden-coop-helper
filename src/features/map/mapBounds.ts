import { latLngBounds } from 'leaflet';
import { MAP_SIZE } from '@/config/constants';

export const MAP_BOUNDS = latLngBounds([0, 0], [MAP_SIZE, MAP_SIZE]);
