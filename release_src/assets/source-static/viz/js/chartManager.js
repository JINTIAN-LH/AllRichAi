// chartManager.js - 图表管理器
// 使用Chart.js管理数据可视化图表

const ChartManager = {
  // 图表实例集合
  charts: {},
  
  // 图表容器元素
  chartContainers: {},
  trendHistory: [],
  maxTrendPoints: 14,
  
  // 初始化图表管理器
  init() {
    this.initializeCharts();
    
    // 监听状态更新，更新图表数据
    StateSync.addStateUpdateCallback((newState, oldState) => {
      this.updateAllCharts(newState);
    });
    
    // 监听窗口大小变化，调整图表
    window.addEventListener('resize', () => {
      this.resizeCharts();
    });
    
    console.log('图表管理器已初始化');
  },
  
  // 初始化所有图表
  initializeCharts() {
    // 初始化收益趋势图
    this.initEarningsChart();
    
    // 初始化资源分布图
    this.initResourceChart();
    
    // 初始化经营效率图
    this.initEfficiencyChart();
  },
  
  // 初始化收益趋势图
  initEarningsChart() {
    const ctx = document.getElementById('earningsChart');
    if (!ctx) return;
    
    this.chartContainers.earnings = ctx;
    
    this.charts.earnings = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['第1天', '第5天', '第10天', '第15天', '第20天', '第25天', '第30天'],
        datasets: [{
          label: '金币收益',
          data: [100, 250, 320, 410, 580, 720, 900],
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false
          },
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          x: {
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          }
        }
      }
    });
  },
  
  // 初始化资源分布图
  initResourceChart() {
    const ctx = document.getElementById('resourceChart');
    if (!ctx) return;
    
    this.chartContainers.resource = ctx;
    
    this.charts.resource = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['金币', '微粒', '土地', '作物'],
        datasets: [{
          data: [45, 25, 15, 15],
          backgroundColor: [
            '#667eea',
            '#f093fb',
            '#4facfe',
            '#00f2fe'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false
          },
          legend: {
            position: 'bottom'
          }
        },
        cutout: '60%' // 环形图
      }
    });
  },
  
  // 初始化经营效率图
  initEfficiencyChart() {
    const ctx = document.getElementById('efficiencyChart');
    if (!ctx) return;
    
    this.chartContainers.efficiency = ctx;
    
    this.charts.efficiency = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['盈利能力', '资源利用', '任务完成', '成长速度', '可持续性'],
        datasets: [{
          label: '经营效率',
          data: [70, 65, 80, 75, 60],
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          pointBackgroundColor: '#4CAF50',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#4CAF50'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false
          },
          legend: {
            display: false
          }
        },
        scales: {
          r: {
            angleLines: {
              display: true,
              color: 'rgba(0,0,0,0.1)'
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            },
            pointLabels: {
              font: {
                size: 10
              }
            },
            ticks: {
              backdropColor: 'transparent',
              maxTicksLimit: 2,
              stepSize: 25
            }
          }
        }
      }
    });
  },
  
  // 根据游戏状态更新所有图表
  updateAllCharts(gameState) {
    if (!gameState) return;

    this.updateEarningsData(gameState);
    this.updateResourceData(gameState);
    this.updateEfficiencyData(gameState);
  },
  
  // 更新收益数据
  updateEarningsData(gameState) {
    if (!this.charts.earnings) return;

    const day = Number(gameState.turn || gameState.day || 1);
    const money = Number(gameState.money || 0);
    const last = this.trendHistory[this.trendHistory.length - 1];
    if (!last || last.day !== day || last.money !== money) {
      this.trendHistory.push({ day, money });
    }
    if (this.trendHistory.length > this.maxTrendPoints) {
      this.trendHistory = this.trendHistory.slice(-this.maxTrendPoints);
    }

    this.charts.earnings.data.labels = this.trendHistory.map((row) => `第${row.day}天`);
    this.charts.earnings.data.datasets[0].data = this.trendHistory.map((row) => row.money);
    this.charts.earnings.update('active');
  },
  
  // 更新资源数据
  updateResourceData(gameState) {
    if (!this.charts.resource) return;

    const money = Number(gameState.money || 0);
    const particles = Number(gameState.particles || 0);
    const land = Number(gameState.land || 0);
    const inventory = gameState.inventory || {};
    const crops = Object.values(inventory).reduce((sum, row) => {
      const item = row || {};
      const isCrop = String(item.type || '').includes('crop');
      const count = Number(item.count ?? item.quantity ?? 0);
      return isCrop ? sum + Math.max(0, count) : sum;
    }, 0);

    this.charts.resource.data.datasets[0].data = [money, particles, land, crops];
    this.charts.resource.update('active');
  },
  
  // 更新经营效率数据
  updateEfficiencyData(gameState) {
    if (!this.charts.efficiency) return;
    
    // 计算各项效率指标
    const efficiencyData = this.calculateEfficiencyMetrics(gameState);
    
    this.charts.efficiency.data.datasets[0].data = efficiencyData;
    this.charts.efficiency.update('active');
  },
  
  // 计算效率指标
  calculateEfficiencyMetrics(gameState) {
    const tasks = gameState.tasks || {};
    const taskRows = Object.values(tasks);
    const completed = taskRows.filter((task) => task.status === 'completed').length;
    const totalTaskCount = Math.max(1, taskRows.length);
    const completionRate = Math.round((completed / totalTaskCount) * 100);

    const plots = Array.isArray(gameState.farm_plots) ? gameState.farm_plots : [];
    const activePlots = plots.filter((plot) => plot.crop_id).length;
    const utilization = plots.length ? Math.round((activePlots / plots.length) * 100) : 0;

    const growthScore = Math.min(100, Math.round((Number(gameState.turn || 1) / 30) * 100));
    const sustainability = Math.min(100, Math.round((Number(gameState.land || 0) / 50) * 100));
    const profitScore = Math.min(100, Math.round(Number(gameState.money || 0) / 100));

    return [
      profitScore,
      utilization,
      completionRate,
      growthScore,
      sustainability,
    ];
  },
  
  // 调整图表大小
  resizeCharts() {
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.resize();
      }
    });
  },
  
  // 销毁图表
  destroyCharts() {
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    this.charts = {};
  },
  
  // 更新特定图表
  updateChart(chartType, newData) {
    if (!this.charts[chartType] || !newData) return;
    
    switch(chartType) {
      case 'earnings':
        this.charts.earnings.data = newData;
        this.charts.earnings.update('active');
        break;
      case 'resource':
        this.charts.resource.data = newData;
        this.charts.resource.update('active');
        break;
      case 'efficiency':
        this.charts.efficiency.data = newData;
        this.charts.efficiency.update('active');
        break;
    }
  },
  
  // 添加数据点到图表
  addDataPoint(chartType, label, data) {
    if (!this.charts[chartType]) return;
    
    const chart = this.charts[chartType];
    chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      dataset.data.push(data[datasetIndex] || data);
    });
    
    // 限制数据点数量，防止图表过于拥挤
    const maxPoints = 20;
    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift(); // 移除最旧的标签
      chart.data.datasets.forEach(dataset => {
        dataset.data.shift(); // 移除最旧的数据点
      });
    }
    
    chart.update('active');
  },
  
  // 获取图表数据
  getChartData(chartType) {
    if (!this.charts[chartType]) return null;
    return this.charts[chartType].data;
  }
};

// 导出ChartManager以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartManager;
} else {
  window.ChartManager = ChartManager;
}