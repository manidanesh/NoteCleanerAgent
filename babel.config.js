module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@/models': './src/models',
          '@/agents': './src/agents',
          '@/services': './src/services',
          '@/ui': './src/ui'
        }
      }
    ]
  ]
};