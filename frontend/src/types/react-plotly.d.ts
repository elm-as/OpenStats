declare module 'react-plotly.js' {
  import type { Component } from 'react';
  import type { Data, Layout, Config, PlotlyHTMLElement } from 'plotly.js';

  export interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: any[];
    revision?: number;
    onInitialized?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onUpdate?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onPurge?: (figure: any, graphDiv: PlotlyHTMLElement) => void;
    onError?: (err: Error) => void;
    divId?: string;
    className?: string;
    style?: React.CSSProperties;
    debug?: boolean;
    useResizeHandler?: boolean;
    onClick?: (event: any) => void;
    onHover?: (event: any) => void;
    onUnhover?: (event: any) => void;
    onSelected?: (event: any) => void;
    onRelayout?: (event: any) => void;
    onRestyle?: (event: any) => void;
  }

  export default class Plot extends Component<PlotParams> {}
}
