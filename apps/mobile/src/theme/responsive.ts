import { Dimensions, PixelRatio } from 'react-native';

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

const getScreen = () => Dimensions.get('window');

export const wp = (percentage: number): number => {
  const { width } = getScreen();
  return (width * percentage) / 100;
};

export const hp = (percentage: number): number => {
  const { height } = getScreen();
  return (height * percentage) / 100;
};

export const fp = (size: number): number => {
  const { width } = getScreen();
  const scale = width / BASE_WIDTH;
  const fontScale = PixelRatio.getFontScale();
  const scaled = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(scaled / fontScale));
};

export const scale = (size: number): number => {
  const { width } = getScreen();
  return Math.round(PixelRatio.roundToNearestPixel(size * (width / BASE_WIDTH)));
};

export const verticalScale = (size: number): number => {
  const { height } = getScreen();
  return Math.round(PixelRatio.roundToNearestPixel(size * (height / BASE_HEIGHT)));
};

export const touchTarget = (size = 44): number => Math.max(44, scale(size));
