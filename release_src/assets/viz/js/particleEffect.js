// particleEffect.js - 粒子效果系统
// 创建和管理各种粒子效果

const ParticleEffect = {
  // 粒子容器
  container: null,
  
  // 可用粒子池
  particlePool: [],
  
  // 最大粒子数
  MAX_PARTICLES: 100,
  
  // 初始化粒子系统
  init() {
    // 创建粒子容器
    this.container = document.getElementById('particle-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'particle-container';
      document.body.appendChild(this.container);
    }
    
    // 预创建粒子元素
    this.preCreateParticles();
    
    console.log('粒子效果系统已初始化');
  },
  
  // 预创建粒子元素
  preCreateParticles() {
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.display = 'none';
      this.container.appendChild(particle);
      this.particlePool.push(particle);
    }
  },
  
  // 获取可用粒子
  getAvailableParticle() {
    for (let i = 0; i < this.particlePool.length; i++) {
      const particle = this.particlePool[i];
      if (particle.style.display === 'none') {
        particle.style.display = 'block';
        return particle;
      }
    }
    
    // 如果没有可用粒子，创建新的（不超过最大限制）
    if (this.particlePool.length < this.MAX_PARTICLES * 1.5) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      this.container.appendChild(particle);
      this.particlePool.push(particle);
      return particle;
    }
    
    return null;
  },
  
  // 释放粒子
  releaseParticle(particle) {
    if (particle) {
      particle.style.display = 'none';
      particle.textContent = '';
      particle.style.left = '0px';
      particle.style.top = '0px';
      particle.style.transform = 'translate(0, 0)';
      particle.style.opacity = '1';
    }
  },
  
  // 创建收获粒子特效
  createHarvestEffect(x, y, options = {}) {
    const count = options.count || 10;
    const icon = options.icon || '🌾';
    const colors = options.colors || ['#FFD700', '#FFA500', '#FF8C00'];
    
    for (let i = 0; i < count; i++) {
      const particle = this.getAvailableParticle();
      if (!particle) continue;
      
      // 设置粒子初始状态
      particle.textContent = icon;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.fontSize = `${Math.random() * 10 + 15}px`;
      particle.style.opacity = '1';
      
      // 计算随机方向和距离
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 50 + 30;
      const duration = Math.random() * 500 + 800; // 800-1300ms
      
      // 使用Web Animations API创建动画
      const animation = particle.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`, opacity: 0 }
        ],
        {
          duration: duration,
          easing: 'cubic-bezier(0, 0.9, 0.57, 1)', // 缓动函数
          fill: 'forwards'
        }
      );
      
      // 动画结束时释放粒子
      animation.onfinish = () => {
        this.releaseParticle(particle);
      };
    }
  },
  
  // 创建升级粒子特效
  createUpgradeEffect(x, y, options = {}) {
    const count = options.count || 15;
    const icon = options.icon || '✨';
    const colors = options.colors || ['#9400D3', '#4B0082', '#FF1493'];
    
    for (let i = 0; i < count; i++) {
      const particle = this.getAvailableParticle();
      if (!particle) continue;
      
      // 设置粒子初始状态
      particle.textContent = icon;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.fontSize = `${Math.random() * 8 + 12}px`;
      particle.style.opacity = '1';
      
      // 计算向上扩散的轨迹
      const angle = (Math.random() - 0.5) * Math.PI / 3; // -30°到30°
      const distance = Math.random() * 60 + 40;
      const duration = Math.random() * 300 + 700; // 700-1000ms
      
      // 使用Web Animations API创建动画
      const animation = particle.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * distance}px, ${-Math.abs(Math.sin(angle) * distance * 1.5)}px) scale(1.2)`, opacity: 0.7 },
          { transform: `translate(${Math.cos(angle) * distance * 1.5}px, ${-Math.abs(Math.sin(angle) * distance * 2)}px) scale(0)`, opacity: 0 }
        ],
        {
          duration: duration,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // 三次贝塞尔曲线
          fill: 'forwards'
        }
      );
      
      // 动画结束时释放粒子
      animation.onfinish = () => {
        this.releaseParticle(particle);
      };
    }
  },
  
  // 创建奖励粒子特效
  createRewardEffect(x, y, options = {}) {
    const count = options.count || 8;
    const icon = options.icon || '💰';
    const colors = options.colors || ['#FFD700', '#FFA500', '#FF8C00', '#FFD700'];
    
    for (let i = 0; i < count; i++) {
      const particle = this.getAvailableParticle();
      if (!particle) continue;
      
      // 设置粒子初始状态
      particle.textContent = icon;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.fontSize = `${Math.random() * 10 + 16}px`;
      particle.style.opacity = '1';
      
      // 计算向上的轨迹，带轻微左右摆动
      const sway = (Math.random() - 0.5) * 30; // 左右摆动幅度
      const height = Math.random() * 80 + 60; // 上升高度
      const duration = Math.random() * 400 + 1000; // 1000-1400ms
      
      // 使用Web Animations API创建动画
      const animation = particle.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${sway}px, -${height/2}px) scale(1.1)`, opacity: 0.9 },
          { transform: `translate(0, -${height}px) scale(0.8)`, opacity: 0.5 },
          { transform: `translate(${-sway}px, -${height * 0.8}px) scale(0.5)`, opacity: 0.2 },
          { transform: `translate(0, -${height * 1.1}px) scale(0)`, opacity: 0 }
        ],
        {
          duration: duration,
          easing: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
          fill: 'forwards'
        }
      );
      
      // 动画结束时释放粒子
      animation.onfinish = () => {
        this.releaseParticle(particle);
      };
    }
  },
  
  // 创建通用粒子特效
  createGenericEffect(x, y, options = {}) {
    const {
      icon = '🔸',
      count = 5,
      colors = ['#667eea', '#764ba2', '#f093fb'],
      shape = 'circle', // circle, square, star
      duration = 1000
    } = options;
    
    for (let i = 0; i < count; i++) {
      const particle = this.getAvailableParticle();
      if (!particle) continue;
      
      // 根据形状设置图标
      let displayIcon = icon;
      if (shape === 'star') displayIcon = '⭐';
      else if (shape === 'heart') displayIcon = '❤️';
      else if (shape === 'diamond') displayIcon = '💎';
      
      // 设置粒子初始状态
      particle.textContent = displayIcon;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.fontSize = `${Math.random() * 8 + 10}px`;
      particle.style.opacity = Math.random() * 0.5 + 0.5;
      
      // 计算随机运动轨迹
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 40 + 20;
      const moveDuration = Math.random() * 300 + duration;
      const rotation = Math.random() * 360; // 随机旋转角度
      
      // 使用Web Animations API创建复杂动画
      const animation = particle.animate(
        [
          { 
            transform: 'translate(0, 0) scale(1) rotate(0deg)', 
            opacity: 1 
          },
          { 
            transform: `translate(${Math.cos(angle) * distance * 0.6}px, ${Math.sin(angle) * distance * 0.6}px) scale(1.2) rotate(${rotation * 0.5}deg)`, 
            opacity: 0.8 
          },
          { 
            transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0.8) rotate(${rotation}deg)`, 
            opacity: 0 
          }
        ],
        {
          duration: moveDuration,
          easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
          fill: 'forwards'
        }
      );
      
      // 动画结束时释放粒子
      animation.onfinish = () => {
        this.releaseParticle(particle);
      };
    }
  },
  
  // 创建连续粒子流效果
  createStreamEffect(x, y, options = {}) {
    const {
      icon = '💧',
      color = '#2196F3',
      interval = 100, // 发射间隔
      duration = 2000, // 效果持续时间
      direction = 'up' // 方向: up, down, left, right, random
    } = options;
    
    let active = true;
    let startTime = Date.now();
    
    const emitParticle = () => {
      if (!active || Date.now() - startTime > duration) {
        active = false;
        return;
      }
      
      const particle = this.getAvailableParticle();
      if (!particle) {
        setTimeout(emitParticle, interval);
        return;
      }
      
      // 设置粒子初始状态
      particle.textContent = icon;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.color = color;
      particle.style.fontSize = `${Math.random() * 6 + 8}px`;
      particle.style.opacity = Math.random() * 0.5 + 0.5;
      
      // 根据方向计算运动轨迹
      let angle = 0;
      switch(direction) {
        case 'up': angle = -Math.PI / 2; break;
        case 'down': angle = Math.PI / 2; break;
        case 'left': angle = Math.PI; break;
        case 'right': angle = 0; break;
        case 'random': angle = Math.random() * Math.PI * 2; break;
        default: angle = -Math.PI / 2; // 默认向上
      }
      
      if (direction === 'random') {
        angle = Math.random() * Math.PI * 2;
      }
      
      const distance = Math.random() * 60 + 30;
      const particleDuration = Math.random() * 400 + 800;
      
      // 使用Web Animations API创建动画
      const animation = particle.animate(
        [
          { transform: 'translate(0, 0)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`, opacity: 0 }
        ],
        {
          duration: particleDuration,
          easing: 'ease-out',
          fill: 'forwards'
        }
      );
      
      // 动画结束时释放粒子
      animation.onfinish = () => {
        this.releaseParticle(particle);
      };
      
      if (active) {
        setTimeout(emitParticle, interval);
      }
    };
    
    // 开始发射粒子
    emitParticle();
    
    // 返回停止函数
    return () => {
      active = false;
    };
  }
};

// 导出ParticleEffect以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ParticleEffect;
} else {
  window.ParticleEffect = ParticleEffect;
}