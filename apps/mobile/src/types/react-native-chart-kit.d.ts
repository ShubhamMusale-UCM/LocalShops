declare module 'react-native-chart-kit' {
  import { ViewStyle, StyleProp } from 'react-native';

  export interface ChartConfig {
    backgroundColor?: string;
    backgroundGradientFrom?: string;
    backgroundGradientFromOpacity?: number;
    backgroundGradientTo?: string;
    backgroundGradientToOpacity?: number;
    color?: (opacity: number) => string;
    labelColor?: (opacity: number) => string;
    strokeWidth?: number;
    barPercentage?: number;
    [key: string]: any;
  }

  export interface ChartProps {
    data: any;
    width: number;
    height: number;
    chartConfig: ChartConfig;
    style?: StyleProp<ViewStyle>;
    [key: string]: any;
  }

  export class LineChart extends React.Component<ChartProps> {}
  export class BarChart extends React.Component<ChartProps> {}
  export class PieChart extends React.Component<ChartProps> {}
  export class ProgressChart extends React.Component<ChartProps> {}
  export class ContributionGraph extends React.Component<ChartProps> {}
  export class StackedBarChart extends React.Component<ChartProps> {}
}
