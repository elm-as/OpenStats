import { Node, Edge } from '@xyflow/react';

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Node[];
  edges: Edge[];
}

export const TEMPLATES: CanvasTemplate[] = [
  {
    id: 'blank',
    name: 'Canvas Vierge',
    description: 'Partez de zéro et construisez votre propre pipeline d\'analyse.',
    icon: '',
    nodes: [],
    edges: [],
  },
  {
    id: 'sales_analysis',
    name: 'Analyse des Ventes',
    description: 'Pipeline type pour nettoyer et analyser des données de ventes (corrélations, tendances).',
    icon: '',
    nodes: [
      { id: 'node_1', type: 'dataset', position: { x: 50, y: 150 }, data: { label: 'Source de Données' } },
      { id: 'node_2', type: 'cleaning', position: { x: 300, y: 150 }, data: { label: 'Nettoyage des Données' } },
      { id: 'node_3', type: 'descriptiveNumeric', position: { x: 550, y: 50 }, data: { label: 'Statistiques Descriptives' } },
      { id: 'node_4', type: 'correlation', position: { x: 550, y: 250 }, data: { label: 'Analyse de Corrélation' } },
      { id: 'node_5', type: 'insights', position: { x: 850, y: 150 }, data: { label: 'Génération Insights IA' } },
      { id: 'node_6', type: 'output', position: { x: 1100, y: 150 }, data: { label: 'Export Rapport PDF' } },
    ],
    edges: [
      { id: 'e1-2', source: 'node_1', target: 'node_2', type: 'animatedDataEdge' },
      { id: 'e2-3', source: 'node_2', target: 'node_3', type: 'animatedDataEdge' },
      { id: 'e2-4', source: 'node_2', target: 'node_4', type: 'animatedDataEdge' },
      { id: 'e3-5', source: 'node_3', target: 'node_5', type: 'animatedDataEdge' },
      { id: 'e4-5', source: 'node_4', target: 'node_5', type: 'animatedDataEdge' },
      { id: 'e5-6', source: 'node_5', target: 'node_6', type: 'animatedDataEdge' },
    ],
  },
  {
    id: 'student_project',
    name: 'Projet Étudiant',
    description: 'Idéal pour un mémoire ou un projet (ACP, statistiques, tests d\'hypothèses).',
    icon: '',
    nodes: [
      { id: 'node_1', type: 'dataset', position: { x: 50, y: 150 }, data: { label: 'Données Étude' } },
      { id: 'node_2', type: 'typing', position: { x: 300, y: 150 }, data: { label: 'Vérification Types' } },
      { id: 'node_3', type: 'pca', position: { x: 550, y: 50 }, data: { label: 'Analyse Composantes Principales' } },
      { id: 'node_4', type: 'testCompareMeans', position: { x: 550, y: 250 }, data: { label: 'Comparaison Moyennes (T-Test)' } },
      { id: 'node_5', type: 'visualization', position: { x: 850, y: 150 }, data: { label: 'Génération Graphiques' } },
    ],
    edges: [
      { id: 'e1-2', source: 'node_1', target: 'node_2', type: 'animatedDataEdge', data: { color: '#38bdf8', speed: '2s', speedOffset: '1s' } },
      { id: 'e2-3', source: 'node_2', target: 'node_3', type: 'animatedDataEdge', data: { color: '#6366f1', speed: '2s', speedOffset: '1s' } },
      { id: 'e2-4', source: 'node_2', target: 'node_4', type: 'animatedDataEdge', data: { color: '#6366f1', speed: '2s', speedOffset: '1s' } },
      { id: 'e3-5', source: 'node_3', target: 'node_5', type: 'animatedDataEdge', data: { color: '#06b6d4', speed: '3s', speedOffset: '1.5s' } },
      { id: 'e4-5', source: 'node_4', target: 'node_5', type: 'animatedDataEdge', data: { color: '#ef4444', speed: '2.5s', speedOffset: '1.25s' } },
    ],
  },
  {
    id: 'quick_cleaning',
    name: 'Nettoyage Rapide',
    description: 'Pipeline express : détection de types, nettoyage automatique, transformation et statistiques de contrôle.',
    icon: '',
    nodes: [
      { id: 'node_1', type: 'dataset', position: { x: 50, y: 150 }, data: { label: 'Fichier source' } },
      { id: 'node_2', type: 'typing', position: { x: 300, y: 150 }, data: { label: 'Détection de Types' } },
      { id: 'node_3', type: 'cleaning', position: { x: 550, y: 80 }, data: { label: 'Nettoyage Auto', strategy: 'auto' } },
      { id: 'node_4', type: 'transform', position: { x: 550, y: 250 }, data: { label: 'Normalisation' } },
      { id: 'node_5', type: 'descriptiveNumeric', position: { x: 850, y: 150 }, data: { label: 'Statistiques de Contrôle' } },
      { id: 'node_6', type: 'output', position: { x: 1100, y: 150 }, data: { label: 'Export Résultat' } },
    ],
    edges: [
      { id: 'e1-2', source: 'node_1', target: 'node_2', type: 'animatedDataEdge', data: { color: '#10b981', speed: '2s', speedOffset: '1s' } },
      { id: 'e2-3', source: 'node_2', target: 'node_3', type: 'animatedDataEdge', data: { color: '#38bdf8', speed: '2s', speedOffset: '1s' } },
      { id: 'e2-4', source: 'node_2', target: 'node_4', type: 'animatedDataEdge', data: { color: '#38bdf8', speed: '2s', speedOffset: '1s' } },
      { id: 'e3-5', source: 'node_3', target: 'node_5', type: 'animatedDataEdge', data: { color: '#f59e0b', speed: '2s', speedOffset: '1s' } },
      { id: 'e4-5', source: 'node_4', target: 'node_5', type: 'animatedDataEdge', data: { color: '#ec4899', speed: '2s', speedOffset: '1s' } },
      { id: 'e5-6', source: 'node_5', target: 'node_6', type: 'animatedDataEdge', data: { color: '#10b981', speed: '1.5s', speedOffset: '0.75s' } },
    ],
  },
];
