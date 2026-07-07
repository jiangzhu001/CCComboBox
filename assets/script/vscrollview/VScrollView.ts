import {
  _decorator,
  Component,
  Enum,
  EventMouse,
  EventTouch,
  input,
  Input,
  instantiate,
  Mask,
  math,
  Node,
  Prefab,
  tween,
  UITransform,
  Vec2,
  Vec3,
  Widget,
} from 'cc';
import { VScrollViewItem } from './VScrollViewItem';

const { ccclass, property, menu } = _decorator;

/** 内部节点池：按类型索引分桶管理 Node/Prefab 实例化的复用 */
class InternalNodePool {
  private pools: Map<number, Node[]> = new Map();
  private prefabs: Prefab[] = [];
  private nodes: Node[] = [];
  private useNodeMode: boolean = false;

  /**
   * 构造函数
   * @param prefabs Prefab 模板数组（不使用 Node 模式时生效）
   * @param nodes  Node 模板数组（传入且非空时优先使用 Node 模式）
   */
  constructor(prefabs: Prefab[], nodes?: Node[]) {
    this.prefabs = prefabs;
    this.nodes = nodes || [];
    this.useNodeMode = nodes && nodes.length > 0;
    const count = this.useNodeMode ? nodes.length : prefabs.length;
    for (let i = 0; i < count; i++) {
      this.pools.set(i, []);
    }
  }

  /**
   * 从指定类型的池中取一个节点；池为空时按对应模板克隆一个新节点
   * @param typeIndex 模板类型索引
   */
  get(typeIndex: number): Node {
    const pool = this.pools.get(typeIndex);
    if (!pool) {
      console.error(`[VScrollView NodePool] 类型 ${typeIndex} 不存在`);
      return null;
    }
    if (pool.length > 0) {
      const node = pool.pop()!;
      node.active = true;
      return node;
    }
    let newNode: Node;
    if (this.useNodeMode) {
      const sourceNode = this.nodes[typeIndex];
      if (!sourceNode) {
        console.error(`[VScrollView NodePool] Node 类型 ${typeIndex} 模板不存在`);
        return null;
      }
      newNode = instantiate(sourceNode);
    } else {
      const sourcePrefab = this.prefabs[typeIndex];
      if (!sourcePrefab) {
        console.error(`[VScrollView NodePool] Prefab 类型 ${typeIndex} 模板不存在`);
        return null;
      }
      newNode = instantiate(sourcePrefab);
    }
    return newNode;
  }

  /**
   * 回收节点到指定类型的池中（隐藏并脱离父级），类型不匹配时直接销毁
   * @param node      待回收的节点
   * @param typeIndex 该节点对应的模板类型索引
   */
  put(node: Node, typeIndex: number) {
    if (!node) return;
    const pool = this.pools.get(typeIndex);
    if (!pool) {
      console.error(`[VScrollView NodePool] 类型 ${typeIndex} 不存在`);
      node.destroy();
      return;
    }
    node.active = false;
    node.removeFromParent();
    pool.push(node);
  }

  /** 销毁池中所有缓存节点并清空池 */
  clear() {
    this.pools.forEach(pool => {
      pool.forEach(node => node.destroy());
      pool.length = 0;
    });
    this.pools.clear();
  }

  /** 调试用：返回各类型池中当前缓存数量 */
  getStats() {
    const stats: any = {};
    this.pools.forEach((pool, type) => {
      stats[`type${type}`] = pool.length;
    });
    return stats;
  }
}

// 渲染指定索引的子项内容
export type RenderItemFn = (node: Node, index: number) => void;
// 按索引提供一个子项节点
export type ProvideNodeFn = (index: number) => Node | Promise<Node>;
// 子项点击回调
export type OnItemClickFn = (node: Node, index: number) => void;
// 子项长按回调
export type OnItemLongPressFn = (node: Node, index: number) => void;
// 新增项首次布局时的入场动画回调
export type PlayItemAppearAnimationFn = (node: Node, index: number) => void;
// 子项边缘进入可视区时回调
export type OnItemEdgeEnterFn = (node: Node, index: number) => void;
// 子项完全进入可视区时回调
export type OnItemFullEnterFn = (node: Node, index: number) => void;
// 返回指定索引子项的主轴尺寸
export type GetItemHeightFn = (index: number) => number;
// 返回指定索引子项的模板类型索引
export type GetItemTypeIndexFn = (index: number) => number;
// 刷新状态变化回调
export type OnRefreshStateChangeFn = (state: RefreshState, offset: number) => void;
// 加载更多状态变化回调
export type OnLoadMoreStateChangeFn = (state: LoadMoreState, offset: number) => void;
// 分页切换回调
export type OnPageChangeFn = (pageIndex: number) => void;

export enum ScrollDirection {
  VERTICAL = 0,
  HORIZONTAL = 1,
}

export enum ItemCreationMode {
  NODE = 0,
  PREFAB = 1,
}

// 添加刷新状态枚举
export enum RefreshState {
  IDLE = 0, // 空闲状态
  PULLING = 1, // 正在拉动（未达到触发阈值）
  READY = 2, // 达到触发阈值，松手即可刷新
  REFRESHING = 3, // 正在刷新中
  COMPLETE = 4, // 刷新完成
}

export enum LoadMoreState {
  IDLE = 0, // 空闲状态
  PULLING = 1, // 正在上拉（未达到触发阈值）
  READY = 2, // 达到触发阈值，松手即可加载
  LOADING = 3, // 正在加载中
  COMPLETE = 4, // 加载完成
  NO_MORE = 5, // 没有更多数据
}

@ccclass('VirtualScrollView')
@menu('2D/VirtualScrollView(虚拟滚动列表)')
export class VirtualScrollView extends Component {
  private static _activeNestedChild: VirtualScrollView | null = null;

  @property({ type: Node, displayName: '容器节点', tooltip: 'content 容器节点（在 Viewport 下）' })
  public content: Node | null = null;

  @property({
    displayName: '启用虚拟列表',
    tooltip: '是否启用虚拟列表模式（关闭则仅提供滚动功能）',
  })
  public useVirtualList: boolean = true;

  @property({
    type: Enum(ScrollDirection),
    displayName: '滚动方向',
    tooltip: '滚动方向：纵向（向上）或横向（向左）',
  })
  public direction: ScrollDirection = ScrollDirection.VERTICAL;

  @property({
    type: Enum(ItemCreationMode),
    displayName: '创建模式',
    tooltip: '使用 Node 或 Prefab 创建子项（默认 Prefab）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public itemCreationMode: ItemCreationMode = ItemCreationMode.PREFAB;

  @property({
    type: Node,
    displayName: '子项节点',
    tooltip: '可选：从 Node 创建 item（等大小模式）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList && !this.useDynamicSize && this.itemCreationMode === ItemCreationMode.NODE;
    },
  })
  public itemNode: Node | null = null;

  @property({
    type: Prefab,
    displayName: '子项预制体',
    tooltip: '可选：从 Prefab 创建 item（等大小模式）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList && !this.useDynamicSize && this.itemCreationMode === ItemCreationMode.PREFAB;
    },
  })
  public itemPrefab: Prefab | null = null;

  @property({
    displayName: '不等大小模式',
    tooltip: '启用不等大小模式',
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public useDynamicSize: boolean = false;

  @property({
    displayName: '自动居中布局',
    tooltip: '当子项数量少于行/列数时，自动居中显示（适用于等大小模式）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList && !this.useDynamicSize;
    },
  })
  public autoCenter: boolean = false;

  @property({
    displayName: '启用分页吸附',
    tooltip: '滚动结束后自动吸附到最近的 item 位置',
  })
  public enablePageSnap: boolean = false;

  @property({
    displayName: '===吸附动画时长',
    tooltip: '吸附动画的持续时间（秒）',
    range: [0.1, 1, 0.05],
    visible(this: VirtualScrollView) {
      return this.enablePageSnap;
    },
  })
  public pageSnapDuration: number = 0.15;

  @property({
    displayName: '===切页距离比例',
    tooltip: '滑动距离超过页面尺寸的此比例时翻页（0.1-0.5）',
    range: [0.1, 0.5, 0.05],
    visible(this: VirtualScrollView) {
      return this.enablePageSnap;
    },
  })
  public pageSnapDistanceRatio: number = 0.15;

  @property({
    displayName: '===吸附触发速度',
    tooltip: '惯性速度低于此值时触发吸附（越大越早吸附）',
    range: [50, 3000, 10],
    visible(this: VirtualScrollView) {
      return this.enablePageSnap;
    },
  })
  public pageSnapTriggerVelocity: number = 600;

  @property({
    displayName: '不等高模式（已废弃,仅保持兼容）',
    tooltip: '启用不等高模式（已废弃,仅保持兼容,请使用 useDynamicSize ）',
  })
  public useDynamicHeight: boolean = false;

  @property({
    displayName: '列数（已废弃,仅保持兼容）',
    tooltip: '列数（已废弃,请使用 gridCount 替代，仅保持兼容）',
  })
  public columns: number = 1;

  @property({
    displayName: '列间距（已废弃,仅保持兼容）',
    tooltip: '列间距（已废弃,请使用 gridSpacing 替代，仅保持兼容）',
  })
  public columnSpacing: number = 0;

  @property({
    type: [Node],
    displayName: '子项节点数组',
    tooltip: '不等大小模式：预先提供的子项节点数组（可在编辑器拖入）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList && this.useDynamicSize && this.itemCreationMode === ItemCreationMode.NODE;
    },
  })
  public itemNodes: Node[] = [];

  @property({
    type: [Prefab],
    displayName: '子项预制体数组',
    tooltip: '不等大小模式：预先提供的子项预制体数组（可在编辑器拖入）',
    visible(this: VirtualScrollView) {
      return this.useVirtualList && this.useDynamicSize && this.itemCreationMode === ItemCreationMode.PREFAB;
    },
  })
  public itemPrefabs: Prefab[] = [];

  private itemMainSize: number = 100;
  private itemCrossSize: number = 100;

  @property({
    displayName: '行/列数',
    tooltip: '纵向模式为列数，横向模式为行数',
    range: [1, 10, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList && !this.useDynamicSize;
    },
  })
  public gridCount: number = 1;

  @property({
    displayName: '副方向间距',
    tooltip: '主方向垂直方向的间距（像素）',
    range: [0, 1000, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList && !this.useDynamicSize;
    },
  })
  public gridSpacing: number = 0;

  @property({
    displayName: '主方向间距',
    tooltip: '主方向的间距（像素）',
    range: [0, 1000, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public spacing: number = 0;

  @property({
    displayName: '头部间距',
    tooltip: '列表头部的额外间距（纵向为顶部，横向为左侧）',
    range: [0, 1000, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public headerSpacing: number = 0;

  @property({
    displayName: '尾部间距',
    tooltip: '列表尾部的额外间距（纵向为底部，横向为右侧）',
    range: [0, 1000, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public footerSpacing: number = 0;

  @property({
    displayName: '总条数',
    tooltip: '总条数（可在运行时 setTotalCount 动态修改）',
    range: [0, 1000, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public totalCount: number = 50;

  @property({
    displayName: '额外缓冲',
    tooltip: '额外缓冲（可视区外多渲染几条，避免边缘复用闪烁）',
    range: [0, 10, 1],
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public buffer: number = 1;

  @property({
    displayName: '启用下拉刷新',
    tooltip: '是否启用下拉刷新功能',
  })
  public enablePullRefresh: boolean = false;

  @property({
    displayName: '===下拉触发距离',
    tooltip: '下拉多少距离触发刷新（像素）',
    range: [50, 500, 10],
    visible(this: VirtualScrollView) {
      return this.enablePullRefresh;
    },
  })
  public pullRefreshThreshold: number = 100;

  @property({
    displayName: '===下拉最大距离',
    tooltip: '下拉的最大阻尼距离（像素）',
    range: [100, 1000, 10],
    visible(this: VirtualScrollView) {
      return this.enablePullRefresh;
    },
  })
  public pullRefreshMaxOffset: number = 150;

  @property({
    displayName: '启用上拉加载',
    tooltip: '是否启用上拉加载更多功能',
  })
  public enableLoadMore: boolean = false;

  @property({
    displayName: '===上拉触发距离',
    tooltip: '距离底部多少距离触发加载（像素）',
    range: [50, 500, 10],
    visible(this: VirtualScrollView) {
      return this.enableLoadMore;
    },
  })
  public loadMoreThreshold: number = 100;

  @property({
    displayName: '===上拉最大距离',
    tooltip: '上拉的最大阻尼距离（像素）',
    range: [100, 1000, 10],
    visible(this: VirtualScrollView) {
      return this.enableLoadMore;
    },
  })
  public loadMoreMaxOffset: number = 150;

  @property({
    displayName: '拉动阻尼系数',
    tooltip: '拉动时的阻尼系数（0-1），越小越难拉',
    range: [0.1, 1, 0.05],
    visible(this: VirtualScrollView) {
      return this.enablePullRefresh || this.enableLoadMore;
    },
  })
  public pullDampingRate: number = 0.5;

  @property({ displayName: '像素对齐', tooltip: '是否启用像素对齐' })
  public pixelAlign: boolean = true;

  @property({
    displayName: '禁用越界滚动',
    tooltip: '是否禁用越界滚动（开启后将无法滚动到边界之外）',
  })
  public disableBounce: boolean = false;

  @property({
    displayName: '嵌套时拦截父滚动',
    tooltip: '嵌套虚拟列表时，子列表可处理当前手势则拦截父级滚动',
    visible(this: VirtualScrollView) {
      return this.useVirtualList;
    },
  })
  public blockParentScroll: boolean = true;

  @property({
    displayName: '限制起手角度',
    tooltip: '开启后，仅当首次滑动角度与列表方向匹配时才开始滚动',
  })
  public limitStartDragAngle: boolean = false;

  @property({
    displayName: '===起手角度阈值',
    tooltip: '仅在开启「限制起手角度」时生效。默认 30°',
    range: [0, 89, 1],
    visible(this: VirtualScrollView) {
      return this.limitStartDragAngle;
    },
  })
  public startDragAngleThreshold: number = 30;

  @property({
    displayName: '惯性阻尼系数',
    tooltip: '指数衰减系数，越大减速越快',
    range: [0, 10, 0.5],
  })
  public inertiaDampK: number = 1;

  @property({ displayName: '弹簧刚度', tooltip: '越界弹簧刚度 K（建议 120–240）' })
  public springK: number = 150.0;

  @property({ displayName: '弹簧阻尼', tooltip: '越界阻尼 C（建议 22–32）' })
  public springC: number = 26.0;

  @property({ displayName: '速度阈值', tooltip: '速度阈值（像素/秒），低于即停止' })
  public velocitySnap: number = 5;

  @property({ displayName: '速度窗口', tooltip: '速度估计窗口（秒）' })
  public velocityWindow: number = 0.08;

  @property({ displayName: '最大惯性速度', tooltip: '最大惯性速度（像素/秒）' })
  public maxVelocity: number = 6000;

  @property({ displayName: 'iOS减速曲线', tooltip: '是否使用 iOS 风格的减速曲线' })
  public useIOSDecelerationCurve: boolean = true;

  @property({ displayName: '启用滚轮', tooltip: '是否启用鼠标滚轮滚动' })
  public enableMouseWheel: boolean = true;

  @property({
    displayName: '滚轮速度',
    tooltip: '鼠标滚轮滚动速度',
    range: [0.1, 10, 0.1],
    visible(this: VirtualScrollView) {
      return this.enableMouseWheel;
    },
  })
  public mouseWheelSpeed: number = 3.0;

  // 渲染子项内容
  public renderItemFn: RenderItemFn | null = null;
  // 动态提供子项节点
  public provideNodeFn: ProvideNodeFn | null = null;
  // 子项点击事件
  public onItemClickFn: OnItemClickFn | null = null;
  // 子项长按事件
  public onItemLongPressFn: OnItemLongPressFn | null = null;
  // 新增项首次布局动画
  public playItemAppearAnimationFn: PlayItemAppearAnimationFn | null = null;
  // 子项边缘进入可视区事件
  public onItemEdgeEnterFn: OnItemEdgeEnterFn | null = null;
  // 子项完全进入可视区事件
  public onItemFullEnterFn: OnItemFullEnterFn | null = null;
  // 动态尺寸查询
  public getItemHeightFn: GetItemHeightFn | null = null;
  // 动态模板类型查询
  public getItemTypeIndexFn: GetItemTypeIndexFn | null = null;
  // 刷新状态变化事件
  public onRefreshStateChangeFn: OnRefreshStateChangeFn | null = null;
  // 加载更多状态变化事件
  public onLoadMoreStateChangeFn: OnLoadMoreStateChangeFn | null = null;
  // 分页切换事件
  public onPageChangeFn: OnPageChangeFn | null = null;

  private _viewportSize = 0;
  private _contentSize = 0;
  private _boundsMin = 0;
  private _boundsMax = 0;
  private _velocity = 0;
  private _isTouching = false;
  private _activeTouchId: number = -1;
  private _velSamples: { t: number; delta: number }[] = [];
  private _slotNodes: Node[] = [];
  private _slots = 0;
  private _slotFirstIndex = 0;
  private _itemSizes: number[] = [];
  private _prefixPositions: number[] = [];
  private _prefabSizeCache: Map<number, number> = new Map();
  private _nodePool: InternalNodePool | null = null;
  private _slotPrefabIndices: number[] = [];
  private _needAnimateIndices: Set<number> = new Set();
  private _initSortLayerFlag: boolean = true;
  private _scrollTween: any = null;
  private _tmpMoveVec2 = new Vec2();

  // 私有状态变量
  private _refreshState: RefreshState = RefreshState.IDLE;
  private _loadMoreState: LoadMoreState = LoadMoreState.IDLE;
  private _pullOffset: number = 0; // 当前下拉偏移量
  private _loadOffset: number = 0; // 当前上拉偏移量
  private _isRefreshing: boolean = false;
  private _isLoadingMore: boolean = false;
  private _hasMore: boolean = true; // 是否还有更多数据

  // 分页吸附相关
  private _currentPageIndex: number = 0;
  private _pageStartPos: number = 0; // 记录触摸开始时的位置
  private _lastWheelTime: number = 0; // 记录上次滚轮时间

  private _touchStartPos: Vec2 = new Vec2();
  private _hasDeterminedScrollDirection: boolean = false;
  private _shouldBlockParent: boolean = false;
  private _parentScrollView: VirtualScrollView | null = null;
  private _scrollDirectionThreshold: number = 15; // 滑动阈值（像素）

  // 等大小模式下，从 content 子节点获取的模板节点
  private _templateNode: Node | null = null;
  private _isStarted: boolean = false;
  private _pendingStartOperations: Array<() => void> = [];
  private _edgeVisibleIndices: Set<number> = new Set();
  private _fullyVisibleIndices: Set<number> = new Set();

  /** 获取 content 节点的 UITransform（内部访问布局尺寸使用） */
  private get _contentTf(): UITransform {
    this.content = this._getContentNode();
    return this.content!.getComponent(UITransform)!;
  }

  /** 获取视窗节点（this.node）的 UITransform */
  private get _viewportTf(): UITransform {
    return this.node.getComponent(UITransform)!;
  }

  /** 获取 content 容器；未绑定时按名字“content”自动查找并提示 */
  private _getContentNode(): Node {
    if (!this.content) {
      console.warn(`[VirtualScrollView] :${this.node.name} 请在属性面板绑定 content 容器节点`);
      this.content = this.node.getChildByName('content');
    }
    return this.content;
  }

  /** 当前是否为纵向滚动 */
  private _isVertical(): boolean {
    return this.direction === ScrollDirection.VERTICAL;
  }

  /** 沿父节点向上查找第一个 VirtualScrollView 组件 */
  private _findParentScrollView(): VirtualScrollView | null {
    let parent = this.node.parent;
    while (parent) {
      const sv = parent.getComponent(VirtualScrollView);
      if (sv) return sv;
      parent = parent.parent;
    }
    return null;
  }

  /** 缓存并返回父滚动视图引用（嵌套场景使用） */
  private _ensureParentScrollView(): VirtualScrollView | null {
    if (!this.blockParentScroll) return null;
    if (this._parentScrollView && this._parentScrollView.node && this._parentScrollView.node.isValid) {
      return this._parentScrollView;
    }
    this._parentScrollView = this._findParentScrollView();
    return this._parentScrollView;
  }

  /** 被父滚动视图取代触摸所有权时，立即终止本列表的当前手势 */
  private _cancelTouchTrackingFromChild() {
    this._isTouching = false;
    this._activeTouchId = -1;
    this._velocity = 0;
    this._velSamples.length = 0;
    this._hasDeterminedScrollDirection = false;
    this._shouldBlockParent = false;
    this._releaseNestedTouchOwner();
  }

  /** 兼容多种引擎版本，从 EventTouch 中提取 touch id */
  private _extractTouchId(e?: EventTouch): number {
    if (!e) return -1;
    const evt = e as any;
    if (typeof evt.getID === 'function') return evt.getID();
    if (evt.touch && typeof evt.touch.getID === 'function') return evt.touch.getID();
    if (typeof evt.touchId === 'number') return evt.touchId;
    return -1;
  }

  /** 判断收到的触摸事件是否属于当前正在跟踪的那一笔 */
  private _isTrackingTouchEvent(e?: EventTouch): boolean {
    if (!this._isTouching) return false;
    if (!e) return true;
    const eventTouchId = this._extractTouchId(e);
    if (this._activeTouchId < 0 || eventTouchId < 0) return true;
    return this._activeTouchId === eventTouchId;
  }

  /** 嵌套场景下声明本列表为当前活动子列表，挤掉旧的所有者 */
  private _acquireNestedTouchOwner() {
    if (!this.blockParentScroll) return;
    const parent = this._ensureParentScrollView();
    if (!parent) return;
    const owner = VirtualScrollView._activeNestedChild;
    if (owner && owner !== this && owner._parentScrollView === parent) {
      owner._cancelTouchTrackingFromChild();
    }
    VirtualScrollView._activeNestedChild = this;
  }

  /** 释放嵌套触摸所有权 */
  private _releaseNestedTouchOwner() {
    if (VirtualScrollView._activeNestedChild === this) {
      VirtualScrollView._activeNestedChild = null;
    }
  }

  private _isMovingTowardStart(delta: number): boolean {
    // 与原有滚动物理保持一致：
    // vertical: delta > 0 视为 towardStart
    // horizontal: delta < 0 视为 towardStart
    return this._isVertical() ? delta > 0 : delta < 0;
  }

  private _isMovingTowardEnd(delta: number): boolean {
    // 与原有滚动物理保持一致：
    // vertical: delta < 0 视为 towardEnd
    // horizontal: delta > 0 视为 towardEnd
    return this._isVertical() ? delta < 0 : delta > 0;
  }

  /** 主轴 delta 在当前位置/边界下，本列表能否消化（用于嵌套是否拦截父级） */
  private _canHandleMainAxisDelta(delta: number): boolean {
    if (delta === 0) return false;
    const minBound = Math.min(this._boundsMin, this._boundsMax);
    const maxBound = Math.max(this._boundsMin, this._boundsMax);
    const pos = this._getContentMainPos();
    const atStartBound = this._isVertical() ? pos <= minBound : pos >= maxBound;
    const atEndBound = this._isVertical() ? pos >= maxBound : pos <= minBound;
    const movingToStart = this._isMovingTowardStart(delta);
    const movingToEnd = this._isMovingTowardEnd(delta);

    if (Math.abs(maxBound - minBound) <= 0.001) {
      // 无可滚动空间时，towardEnd 对应刷新方向，towardStart 对应加载方向
      if (movingToEnd) return this.enablePullRefresh;
      if (movingToStart) return this.enableLoadMore && this._hasMore;
      return false;
    }
    if (!atStartBound && !atEndBound) return true;
    if (atStartBound && movingToEnd) return true;
    if (atEndBound && movingToStart) return true;
    if (atStartBound && movingToStart) return this.enablePullRefresh;
    if (atEndBound && movingToEnd) return this.enableLoadMore && this._hasMore;
    return false;
  }

  /** 获取视窗主轴尺寸（纵＝高，横＝宽） */
  private _getViewportMainSize(): number {
    return this._isVertical() ? this._viewportTf.height : this._viewportTf.width;
  }

  /** 获取 content 当前主轴坐标 */
  private _getContentMainPos(): number {
    return this._isVertical() ? this.content!.position.y : this.content!.position.x;
  }

  /** 获取主轴末端边界值（纵＝boundsMax，横＝boundsMin） */
  private _getEndBound(): number {
    return this._isVertical() ? this._boundsMax : this._boundsMin;
  }

  /** 判断位置是否接近末端边界 */
  private _isNearEndBound(pos: number, epsilon: number = 2): boolean {
    return Math.abs(pos - this._getEndBound()) <= epsilon;
  }

  /** 设置 content 主轴坐标，可选像素对齐 */
  private _setContentMainPos(pos: number) {
    if (!Number.isFinite(pos)) return;
    if (this.pixelAlign) pos = Math.round(pos);
    const p = this.content!.position;
    if (this._isVertical()) {
      if (pos === p.y) return;
      this.content!.setPosition(p.x, pos, p.z);
    } else {
      if (pos === p.x) return;
      this.content!.setPosition(pos, p.y, p.z);
    }
  }

  /** 组件启动：初始化容器/边界/触摸/虚拟槽位 */
  async start() {
    this.content = this._getContentNode();
    if (!this.content) return;
    this._parentScrollView = this._findParentScrollView();
    const mask = this.node.getComponent(Mask);
    if (!mask) console.warn('[VirtualScrollView] 建议在视窗节点挂一个 Mask 组件用于裁剪');
    this.gridCount = Math.max(1, Math.round(this.gridCount));

    // 保证在 Widget 上下拉伸场景下读取到真实尺寸
    const viewportWidget = this.node.getComponent(Widget);
    if (viewportWidget) {
      viewportWidget.updateAlignment();
    }


    if (!this.useVirtualList) {
      this._viewportSize = this._getViewportMainSize();
      this._contentSize = this._isVertical() ? this._contentTf.height : this._contentTf.width;
      if (this._isVertical()) {
        this._boundsMin = 0;
        this._boundsMax = Math.max(0, this._contentSize - this._viewportSize);
      } else {
        this._boundsMin = -Math.max(0, this._contentSize - this._viewportSize);
        this._boundsMax = 0;
      }
      this._bindTouch();
      this._bindGlobalTouch();
      this._isStarted = true;
      this._flushPendingStartOperations();
      return;
    }

    // 等大小模式：如果没有预制体但 content 下有子节点，保存第一个子节点作为模板
    if (!this.useDynamicSize && !this.itemPrefab && this.content.children.length > 0) {
      this._templateNode = this.content.children[0];
      this._templateNode.removeFromParent(); // 只移除，不销毁
    }

    this.content.removeAllChildren();
    this._viewportSize = this._getViewportMainSize();
    //兼容废弃属性
    if (this.useDynamicHeight) {
      this.useDynamicSize = true;
    }

    //兼容之前版本的参数
    if (this.columns && this.direction === ScrollDirection.VERTICAL) {
      this.gridCount = this.columns;
    }
    if (this.columnSpacing && this.direction === ScrollDirection.VERTICAL) {
      this.gridSpacing = this.columnSpacing;
    }

    if (this.useDynamicSize) await this._initDynamicSizeMode();
    else await this._initFixedSizeMode();
    this._bindTouch();
    this._bindGlobalTouch();
    this._isStarted = true;
    this._updateVisible(true);
    this._flushPendingStartOperations();
  }

  /** 释放节点池、模板、监听器等资源 */
  onDestroy() {
    this._pendingStartOperations.length = 0;
    this._isStarted = false;
    this._edgeVisibleIndices.clear();
    this._fullyVisibleIndices.clear();
    this._releaseNestedTouchOwner();
    input.off(Input.EventType.TOUCH_END, this._onGlobalTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this._onGlobalTouchEnd, this);
    // 捕获阶段绑定，解绑时 useCapture 必须一致
    this.node.off(Node.EventType.TOUCH_START, this._onDown, this, true);
    this.node.off(Node.EventType.TOUCH_MOVE, this._onMove, this, true);
    this.node.off(Node.EventType.TOUCH_END, this._onUp, this, true);
    this.node.off(Node.EventType.TOUCH_CANCEL, this._onUp, this, true);
    this.node.off(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
    if (this._nodePool) {
      this._nodePool.clear();
      this._nodePool = null;
    }

    // 销毁模板节点
    if (this._templateNode) {
      this._templateNode.destroy();
      this._templateNode = null;
    }

    if (this.itemNode) {
      this.itemNode.destroy();
      this.itemNode = null;
    }

    if (this.itemNodes) {
      for (let i = this.itemNodes.length - 1; i >= 0; i--) {
        this.itemNodes[i].destroy();
        this.itemNodes[i] = null;
      }
    }
  }

  /** 绑定本节点的触摸/滚轮事件。
   *  注意：使用捕获阶段(useCapture=true)，避免子节点上的 Button 等组件在 _onTouchBegan 中
   *  调用 event.propagationStopped = true 拦截事件，导致 TOUCH_START 无法冒泡到 VScrollView，
   *  从而出现「手指按在带按钮的 item 上无法滑动列表」的问题。捕获阶段不会阻断后续 Button 接收事件。 */
  private _bindTouch() {
    this.node.on(Node.EventType.TOUCH_START, this._onDown, this, true);
    this.node.on(Node.EventType.TOUCH_MOVE, this._onMove, this, true);
    this.node.on(Node.EventType.TOUCH_END, this._onUp, this, true);
    this.node.on(Node.EventType.TOUCH_CANCEL, this._onUp, this, true);
    if (this.enableMouseWheel) {
      this.node.on(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
    }
  }

  /** start 完成前调用的公共 API 推迟到 start 后再执行 */
  private _runOrQueueAfterStart(operation: () => void): boolean {
    if (this._isStarted) return false;
    this._pendingStartOperations.push(operation);
    return true;
  }

  /** start 完成后依次执行排队的延迟操作 */
  private _flushPendingStartOperations() {
    if (this._pendingStartOperations.length === 0) return;
    const operations = this._pendingStartOperations.slice();
    this._pendingStartOperations.length = 0;
    for (const operation of operations) {
      operation();
    }
  }

  /** 鼠标滚轮处理：嵌套拦截、分页跳页或转换为速度 */
  private _onMouseWheel(e: EventMouse) {
    if (!this.enableMouseWheel) return;
    const scrollY = e.getScrollY();
    if (scrollY === 0) return;
    const hasParent = !!this._ensureParentScrollView();
    const wheelMainDelta = this._isVertical() ? -scrollY : scrollY;
    const sameAxisWithParent = hasParent && this._parentScrollView ? this._parentScrollView.direction === this.direction : false;
    if (hasParent && this.blockParentScroll && (!sameAxisWithParent || this._canHandleMainAxisDelta(wheelMainDelta))) {
      e.propagationStopped = true;
      this._parentScrollView?._cancelTouchTrackingFromChild();
    }

    if (this.enablePageSnap) {
      // 分页模式下，让滚轮也触发翻页
      const now = performance.now();
      // 阈值判断和冷却时间，避免部分设备（如触控板）过快跳页
      if (now - this._lastWheelTime < 150) return;
      if (Math.abs(scrollY) < 1) return;

      this._lastWheelTime = now;
      const pageOffset = scrollY > 0 ? -1 : 1;
      const targetPage = math.clamp(this._currentPageIndex + pageOffset, 0, this._getMaxPageIndex());

      if (targetPage !== this._currentPageIndex) {
        this.scrollToPage(targetPage, true);
      }
      return;
    }

    if (this._isVertical()) {
      // 默认 scrollY 为正代表向上滚（手指向上拨动，看上面的内容）
      // 在纵向模式下，pos 增加代表视口向下移动。
      // 所以滚轮 Y 为正（向上滚）应该让 pos 减小。
      this._velocity = -scrollY * this.mouseWheelSpeed;
    } else {
      // 在横向模式下，pos 增加代表视口向左移动（看左边的内容）。
      // 滚轮 Y 为正（向上/向左滚）应该让 pos 增加。
      this._velocity = scrollY * this.mouseWheelSpeed;
    }

    // 限制最大速度
    this._velocity = math.clamp(this._velocity, -this.maxVelocity, this.maxVelocity);
  }

  /** 绑定全局 TOUCH_END/CANCEL，避免手指划出节点导致漏抓抬起 */
  private _bindGlobalTouch() {
    input.on(Input.EventType.TOUCH_END, this._onGlobalTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this._onGlobalTouchEnd, this);
  }

  /** 全局触摸结束转发到 _onUp */
  private _onGlobalTouchEnd(event: EventTouch) {
    if (this._isTrackingTouchEvent(event)) {
      this._onUp(event);
    }
  }

  /** 等大小模式初始化：采样模板尺寸、创建可视槽位 */
  private async _initFixedSizeMode() {
    if (!this.provideNodeFn) {
      this.provideNodeFn = (index: number) => {
        // Node 模式
        if (this.itemCreationMode === ItemCreationMode.NODE) {
          if (this.itemNode) return instantiate(this.itemNode);
          if (this._templateNode) return instantiate(this._templateNode);
        }
        // Prefab 模式
        if (this.itemCreationMode === ItemCreationMode.PREFAB) {
          if (this.itemPrefab) return instantiate(this.itemPrefab);
        }
        // 兼容旧版本：如果没有设置模式，尝试 itemPrefab 或模板节点
        if (this.itemPrefab) return instantiate(this.itemPrefab);
        if (this._templateNode) return instantiate(this._templateNode);
        // 都没有则警告并创建默认节点
        console.warn('[VirtualScrollView] 没有提供 itemNode/itemPrefab 或模板节点');
        const n = new Node('item-auto-create');
        const size = this._isVertical() ? this._viewportTf.width : this._viewportTf.height;
        n.addComponent(UITransform).setContentSize(this._isVertical() ? size : this.itemMainSize, this._isVertical() ? this.itemMainSize : size);
        return n;
      };
    }
    let item_pre = this.provideNodeFn(0);
    if (item_pre instanceof Promise) item_pre = await item_pre;
    const uit = item_pre.getComponent(UITransform);
    if (this._isVertical()) {
      this.itemMainSize = uit.height;
      this.itemCrossSize = uit.width;
    } else {
      this.itemMainSize = uit.width;
      this.itemCrossSize = uit.height;
    }
    this._recomputeContentSize();
    const stride = this.itemMainSize + this.spacing;
    const visibleLines = Math.ceil(this._viewportSize / stride);
    this._slots = Math.max(1, (visibleLines + this.buffer + 2) * this.gridCount);
    for (let i = 0; i < this._slots; i++) {
      const n = instantiate(item_pre);
      n.parent = this.content!;
      const itf = n.getComponent(UITransform);
      if (itf) {
        if (this._isVertical()) {
          itf.width = this.itemCrossSize;
          itf.height = this.itemMainSize;
        } else {
          itf.width = this.itemMainSize;
          itf.height = this.itemCrossSize;
        }
      }
      this._slotNodes.push(n);
    }
    this._slotFirstIndex = 0;
    this._layoutSlots(this._slotFirstIndex, true);
  }

  /** 不等大小模式初始化：构建尺寸表、节点池、动态槽位 */
  private async _initDynamicSizeMode() {
    if (this.getItemHeightFn) {
      console.log('[VirtualScrollView] 使用外部提供的 getItemHeightFn');
      this._itemSizes = [];
      for (let i = 0; i < this.totalCount; i++) {
        this._itemSizes.push(this.getItemHeightFn(i));
      }
      this._buildPrefixSum();
      // Node 模式
      if (this.itemCreationMode === ItemCreationMode.NODE && this.itemNodes.length > 0) {
        console.log('[VirtualScrollView] 初始化节点池（Node 模式）');
        this._nodePool = new InternalNodePool([], this.itemNodes);
      }
      // Prefab 模式
      else if (this.itemCreationMode === ItemCreationMode.PREFAB && this.itemPrefabs.length > 0) {
        console.log('[VirtualScrollView] 初始化节点池（Prefab 模式）');
        this._nodePool = new InternalNodePool(this.itemPrefabs);
      }
      // 兼容旧版本
      else if (this.itemPrefabs.length > 0) {
        console.log('[VirtualScrollView] 初始化节点池（兼容模式）');
        this._nodePool = new InternalNodePool(this.itemPrefabs);
      } else {
        console.error('[VirtualScrollView] 需要至少一个 itemNode 或 itemPrefab');
        return;
      }
      this._initDynamicSlots();
      return;
    }
    // Node 模式
    const useNodeMode = this.itemCreationMode === ItemCreationMode.NODE;
    const hasNodes = this.itemNodes.length > 0;
    const hasPrefabs = this.itemPrefabs.length > 0;

    if ((useNodeMode && !hasNodes && !hasPrefabs) || (!useNodeMode && !hasPrefabs) || !this.getItemTypeIndexFn) {
      console.error(
        '[VirtualScrollView] 不等大小模式必须提供以下之一：\n1. getItemHeightFn 回调函数\n2. itemNodes/itemPrefabs 数组 + getItemTypeIndexFn 回调函数'
      );
      return;
    }

    // 根据模式选择模板源
    const templates = useNodeMode && hasNodes ? this.itemNodes : this.itemPrefabs;
    const modeName = useNodeMode && hasNodes ? 'Node' : 'Prefab';

    console.log(`[VirtualScrollView] 使用采样模式（从 ${modeName} 采样尺寸）`);

    // 初始化节点池
    if (useNodeMode && hasNodes) {
      this._nodePool = new InternalNodePool([], this.itemNodes);
    } else {
      this._nodePool = new InternalNodePool(this.itemPrefabs);
    }

    this._prefabSizeCache.clear();
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const sampleNode = instantiate(template as any);
      const uit = sampleNode.getComponent(UITransform);
      const size = this._isVertical() ? uit?.height || 100 : uit?.width || 100;
      this._prefabSizeCache.set(i, size);
      sampleNode.destroy();
      console.log(`[VirtualScrollView] ${modeName}[${i}] 采样尺寸: ${size}`);
    }
    this._itemSizes = [];
    for (let i = 0; i < this.totalCount; i++) {
      const typeIndex = this.getItemTypeIndexFn(i);
      const size = this._prefabSizeCache.get(typeIndex);
      if (size !== undefined) {
        this._itemSizes.push(size);
      } else {
        console.warn(`[VirtualScrollView] 索引 ${i} 的类型索引 ${typeIndex} 无效，使用默认尺寸`);
        this._itemSizes.push(this._prefabSizeCache.get(0) || 100);
      }
    }
    this._buildPrefixSum();
    this._initDynamicSlots();
  }

  /** 不等大小模式根据视口和平均尺寸计算所需槽位数并占位 */
  private _initDynamicSlots() {
    const avgSize = this._contentSize / this.totalCount || 100;
    const visibleCount = Math.ceil(this._viewportSize / avgSize);
    let neededSlots = visibleCount + this.buffer * 2 + 4;
    const minSlots = Math.ceil(this._viewportSize / 80) + this.buffer * 2;
    neededSlots = Math.max(neededSlots, minSlots);
    const maxSlots = Math.ceil(this._viewportSize / 50) + this.buffer * 4;
    neededSlots = Math.min(neededSlots, maxSlots);
    this._slots = Math.min(neededSlots, Math.max(this.totalCount, minSlots));
    this._slotNodes = new Array(this._slots).fill(null);
    this._slotPrefabIndices = new Array(this._slots).fill(-1);
    this._slotFirstIndex = 0;
    this._layoutSlots(this._slotFirstIndex, true);
    console.log(`[VScrollView] 初始化槽位: ${this._slots} (总数据: ${this.totalCount}, 视口尺寸: ${this._viewportSize})`);
  }

  /** 重新构建所有 item 的前缀位置数组并刷新 content 尺寸/边界 */
  private _buildPrefixSum() {
    const hasContent = !!this.content;
    const oldPos = hasContent ? this._getContentMainPos() : 0;
    const wasAtEnd = this._isStarted && hasContent ? this._isNearEndBound(oldPos) : false;

    const n = this._itemSizes.length;
    this._prefixPositions = new Array(n);
    // 从 headerSpacing 开始
    let acc = this.headerSpacing;
    for (let i = 0; i < n; i++) {
      this._prefixPositions[i] = acc;
      acc += this._itemSizes[i] + this.spacing;
    }
    // 内容总大小 = 最后一个位置 + 最后一项大小 - spacing + footerSpacing
    this._contentSize = acc - this.spacing + this.footerSpacing;
    if (this._contentSize < 0) this._contentSize = 0;
    if (this._isVertical()) this._contentTf.height = Math.max(this._contentSize, this._viewportSize);
    else this._contentTf.width = Math.max(this._contentSize, this._viewportSize);

    if (this._isVertical()) {
      this._boundsMin = 0;
      this._boundsMax = Math.max(0, this._contentSize - this._viewportSize);
    } else {
      this._boundsMin = -Math.max(0, this._contentSize - this._viewportSize);
      this._boundsMax = 0;
    }

    if (wasAtEnd) {
      this._setContentMainPos(this._getEndBound());
    }
  }

  /** 二分查找：根据滚动位置定位到第一个可见 item 的索引 */
  private _posToFirstIndex(pos: number): number {
    // _prefixPositions 已经包含了 headerSpacing，直接查找即可
    if (pos <= this.headerSpacing) return 0; // 修改：如果在 header 区域内，返回 0

    let l = 0,
      r = this._prefixPositions.length - 1,
      ans = this._prefixPositions.length;
    while (l <= r) {
      const m = (l + r) >> 1;
      if (this._prefixPositions[m] > pos) {
        ans = m;
        r = m - 1;
      } else {
        l = m + 1;
      }
    }
    return Math.max(0, ans - 1);
  }

  /** 计算当前滚动位置下的可见区间（含 buffer） */
  private _calcVisibleRange(scrollPos: number): { start: number; end: number } {
    const n = this._prefixPositions.length;
    if (n === 0) return { start: 0, end: 0 };

    const start = this._posToFirstIndex(scrollPos);
    const endPos = scrollPos + this._viewportSize;
    let end = start;

    // 找到第一个起始位置超出可视区域的 item
    while (end < n) {
      if (this._prefixPositions[end] >= endPos) break; // 恢复原来的逻辑
      end++;
    }

    return { start: Math.max(0, start - this.buffer), end: Math.min(n, end + this.buffer) };
  }

  /** 获取 item 在主轴上的起始坐标（统一处理等大小/不等大小） */
  private _getItemMainStart(index: number): number {
    if (this.useDynamicSize) {
      return this._prefixPositions[index] || 0;
    }
    const line = Math.floor(index / this.gridCount);
    return this.headerSpacing + line * (this.itemMainSize + this.spacing);
  }

  /** 获取 item 在主轴上的尺寸（统一处理等大小/不等大小） */
  private _getItemMainSize(index: number): number {
    if (this.useDynamicSize) {
      return this._itemSizes[index] || 0;
    }
    return this.itemMainSize;
  }

  /** 派发 item 边缘进入/完全进入可视区的回调 */
  private _dispatchItemEnterCallbacks() {
    if (!this.useVirtualList) return;
    if (!this.onItemEdgeEnterFn && !this.onItemFullEnterFn) return;

    const viewportStart = this._isVertical() ? this._getContentMainPos() : -this._getContentMainPos();
    const viewportEnd = viewportStart + this._viewportSize;
    const nextEdgeVisibleIndices: Set<number> = new Set();
    const nextFullyVisibleIndices: Set<number> = new Set();

    for (let slot = 0; slot < this._slots; slot++) {
      const index = this._slotFirstIndex + slot;
      const node = this._slotNodes[slot];
      if (!node || !node.active || index < 0 || index >= this.totalCount) continue;

      const itemStart = this._getItemMainStart(index);
      const itemEnd = itemStart + this._getItemMainSize(index);
      const isEdgeVisible = itemStart < viewportEnd && itemEnd > viewportStart;
      if (!isEdgeVisible) continue;

      nextEdgeVisibleIndices.add(index);
      if (!this._edgeVisibleIndices.has(index) && this.onItemEdgeEnterFn) {
        this.onItemEdgeEnterFn(node, index);
      }

      const isFullyVisible = itemStart >= viewportStart && itemEnd <= viewportEnd;
      if (!isFullyVisible) continue;

      nextFullyVisibleIndices.add(index);
      if (!this._fullyVisibleIndices.has(index) && this.onItemFullEnterFn) {
        this.onItemFullEnterFn(node, index);
      }
    }

    this._edgeVisibleIndices = nextEdgeVisibleIndices;
    this._fullyVisibleIndices = nextFullyVisibleIndices;
  }

  /** 帧更新：处理惯性、弹簧回弹、刷新/加载吸附位置、分页吸附 */
  update(dt: number) {
    if (!this.content || this._isTouching || this._scrollTween) return;
    let pos = this._getContentMainPos();
    let a = 0;

    const minBound = Math.min(this._boundsMin, this._boundsMax);
    const maxBound = Math.max(this._boundsMin, this._boundsMax);

    // 处理刷新/加载状态
    if (this._isRefreshing && this._refreshState === RefreshState.REFRESHING) {
      // 刷新中，保持在刷新位置
      const refreshPos = this._isVertical() ? -this.pullRefreshThreshold : this.pullRefreshThreshold;
      a = -this.springK * (pos - refreshPos) - this.springC * this._velocity;
    } else if (this._isLoadingMore && this._loadMoreState === LoadMoreState.LOADING) {
      // 加载中，保持在加载位置
      const loadPos = this._isVertical() ? this._boundsMax + this.loadMoreThreshold : this._boundsMin - this.loadMoreThreshold;
      a = -this.springK * (pos - loadPos) - this.springC * this._velocity;
    } else if (pos < minBound) {
      // 如果禁用越界滚动，直接限制位置并停止速度
      if (this.disableBounce) {
        this._setContentMainPos(minBound);
        this._velocity = 0;
        return;
      }
      a = -this.springK * (pos - minBound) - this.springC * this._velocity;
    } else if (pos > maxBound) {
      // 如果禁用越界滚动，直接限制位置并停止速度
      if (this.disableBounce) {
        this._setContentMainPos(maxBound);
        this._velocity = 0;
        return;
      }
      a = -this.springK * (pos - maxBound) - this.springC * this._velocity;
    } else {
      if (this.useIOSDecelerationCurve) {
        const speed = Math.abs(this._velocity);
        if (speed > 2000) this._velocity *= Math.exp(-this.inertiaDampK * 0.7 * dt);
        else if (speed > 500) this._velocity *= Math.exp(-this.inertiaDampK * dt);
        else this._velocity *= Math.exp(-this.inertiaDampK * 1.3 * dt);
      } else {
        this._velocity *= Math.exp(-this.inertiaDampK * dt);
      }
    }

    this._velocity += a * dt;

    // 分页吸附模式：使用单独的速度阈值
    if (this.enablePageSnap && Math.abs(this._velocity) < this.pageSnapTriggerVelocity && a === 0) {
      this._velocity = 0;
      this._performPageSnap();
      return;
    }

    if (Math.abs(this._velocity) < this.velocitySnap && a === 0) this._velocity = 0;
    if (this._velocity !== 0) {
      pos += this._velocity * dt;

      // 如果禁用越界滚动，限制位置在边界内
      if (this.disableBounce) {
        pos = math.clamp(pos, minBound, maxBound);
      }

      if (this.pixelAlign) pos = Math.round(pos);
      this._setContentMainPos(pos);
      if (this.useVirtualList) this._updateVisible(false);
    }
  }

  /**
   * 更新单个 item 的主轴尺寸；不传 size 则回调 getItemHeightFn 重新测量
   * @param index   item 索引
   * @param newSize 可选的新尺寸
   */
  public updateItemHeight(index: number, newSize?: number) {
    if (!this.useDynamicSize) {
      console.warn('[VScrollView] 只有不等大小模式支持 updateItemHeight');
      return;
    }
    if (index < 0 || index >= this.totalCount) {
      console.warn(`[VScrollView] 索引 ${index} 超出范围`);
      return;
    }
    let size = newSize;
    if (size === undefined) {
      if (this.getItemHeightFn) {
        size = this.getItemHeightFn(index);
      } else {
        console.error('[VScrollView] 没有提供 newSize 参数，且未设置 getItemHeightFn');
        return;
      }
    }
    if (this._itemSizes[index] === size) return;
    this._itemSizes[index] = size;
    this._rebuildPrefixSumFrom(index);
    this._updateVisible(true);
  }

  /** 从指定索引起增量重建前缀位置数组（避免每次全量计算） */
  private _rebuildPrefixSumFrom(startIndex: number) {
    const hasContent = !!this.content;
    const oldPos = hasContent ? this._getContentMainPos() : 0;
    const wasAtEnd = this._isStarted && hasContent ? this._isNearEndBound(oldPos) : false;

    if (startIndex === 0) {
      this._buildPrefixSum();
      return;
    }
    let acc = this._prefixPositions[startIndex - 1] + this._itemSizes[startIndex - 1] + this.spacing;
    for (let i = startIndex; i < this._itemSizes.length; i++) {
      this._prefixPositions[i] = acc;
      acc += this._itemSizes[i] + this.spacing;
    }
    this._contentSize = acc - this.spacing + this.footerSpacing;
    if (this._contentSize < 0) this._contentSize = 0;
    if (this._isVertical()) this._contentTf.height = Math.max(this._contentSize, this._viewportSize);
    else this._contentTf.width = Math.max(this._contentSize, this._viewportSize);

    if (this._isVertical()) {
      this._boundsMin = 0;
      this._boundsMax = Math.max(0, this._contentSize - this._viewportSize);
    } else {
      this._boundsMin = -Math.max(0, this._contentSize - this._viewportSize);
      this._boundsMax = 0;
    }

    if (wasAtEnd) {
      this._setContentMainPos(this._getEndBound());
    }
  }

  /**
   * 批量更新多个 item 尺寸，从最小变化索引起增量重建前缀和
   * @param updates 包含 index 和 height 的变更列表
   */
  public updateItemHeights(updates: Array<{ index: number; height: number }>) {
    if (!this.useDynamicSize) {
      console.warn('[VScrollView] 只有不等大小模式支持 updateItemHeights');
      return;
    }
    if (updates.length === 0) return;
    let minIndex = this.totalCount;
    let hasChange = false;
    for (const { index, height } of updates) {
      if (index < 0 || index >= this.totalCount) continue;
      if (this._itemSizes[index] !== height) {
        this._itemSizes[index] = height;
        minIndex = Math.min(minIndex, index);
        hasChange = true;
      }
    }
    if (!hasChange) return;
    this._rebuildPrefixSumFrom(minIndex);
    this._updateVisible(true);
  }

  /**
   * 刷新列表：传数组按 length 设置，传数字直接设为 totalCount
   * @param data 数据数组或总条数
   */
  public refreshList(data: any[] | number) {
    if (this._runOrQueueAfterStart(() => this.refreshList(data))) return;
    if (!this.useVirtualList) {
      console.warn('[VirtualScrollView] 简单滚动模式不支持 refreshList');
      return;
    }
    if (typeof data === 'number') this.setTotalCount(data);
    else this.setTotalCount(data.length);
  }

  /**
   * 设置数据总条数，自动扩容槽位/重算尺寸/标记新增项入场动画
   * @param count 新的总条数
   */
  public setTotalCount(count: number) {
    this._getContentNode();
    if (!this.useVirtualList) {
      console.warn('[VScrollView] 非虚拟列表模式，不支持 setTotalCount');
      return;
    }
    this._upWidgetAlignment();
    const oldCount = this.totalCount;
    this.totalCount = Math.max(0, count | 0);
    if (this.totalCount > oldCount) {
      for (let i = oldCount; i < this.totalCount; i++) {
        this._needAnimateIndices.add(i);
      }
    }
    if (this.useDynamicSize) {
      const oldLength = this._itemSizes.length;
      if (this.totalCount > oldLength) {
        for (let i = oldLength; i < this.totalCount; i++) {
          let size = 100;
          if (this.getItemHeightFn) {
            size = this.getItemHeightFn(i);
          } else if (this.getItemTypeIndexFn && this._prefabSizeCache.size > 0) {
            const typeIndex = this.getItemTypeIndexFn(i);
            size = this._prefabSizeCache.get(typeIndex) || 100;
          }
          this._itemSizes.push(size);
        }
      } else if (this.totalCount < oldLength) {
        this._itemSizes.length = this.totalCount;
      }
      this._buildPrefixSum();
      if (this.totalCount > oldCount) this._expandSlotsIfNeeded();
    } else {
      this._recomputeContentSize();
    }
    this._slotFirstIndex = math.clamp(this._slotFirstIndex, 0, Math.max(0, this.totalCount - 1));
    if (!this.useDynamicSize) {
      this._layoutSlots(this._slotFirstIndex, true);
    }
    this._updateVisible(true);
  }

  /** 强制刷新视窗/content 上的 Widget，避免读到未拉伸的尺寸 */
  _upWidgetAlignment() {
    this.content?.getComponent?.(Widget)?.updateAlignment?.();
    this.node?.getComponent?.(Widget)?.updateAlignment?.();
  }

  /** totalCount 增加后按需扩容槽位数组 */
  private _expandSlotsIfNeeded() {
    let neededSlots = 0;
    let pos = 0;
    const endPos = this._viewportSize;
    for (let i = 0; i < this.totalCount; i++) {
      if (pos >= endPos) break;
      neededSlots++;
      pos += this._itemSizes[i] + this.spacing;
    }
    neededSlots += this.buffer * 2 + 4;
    const minSlots = Math.ceil(this._viewportSize / 80) + this.buffer * 2;
    neededSlots = Math.max(neededSlots, minSlots);
    const maxSlots = Math.ceil(this._viewportSize / 50) + this.buffer * 4;
    neededSlots = Math.min(neededSlots, maxSlots);
    if (neededSlots > this._slots) {
      const oldSlots = this._slots;
      this._slots = neededSlots;
      for (let i = oldSlots; i < this._slots; i++) {
        this._slotNodes.push(null);
        this._slotPrefabIndices.push(-1);
      }
      console.log(`[VScrollView] 槽位扩展: ${oldSlots} -> ${this._slots} (总数据: ${this.totalCount})`);
    }
  }

  /**
   * 滚动到指定主轴坐标（支持 tween 动画）
   * @param targetPos 目标坐标（会被限制在边界内）
   * @param animate   是否使用动画
   * @param duration  动画时长（秒），不传则按距离自动计算
   */
  private _scrollToPosition(targetPos: number, animate = false, duration?: number) {
    targetPos = math.clamp(targetPos, this._boundsMin, this._boundsMax);
    if (this._scrollTween) {
      this._scrollTween.stop();
      this._scrollTween = null;
    }
    this._velocity = 0;
    this._isTouching = false;
    this._activeTouchId = -1;
    this._velSamples.length = 0;
    if (!animate) {
      this._setContentMainPos(this.pixelAlign ? Math.round(targetPos) : targetPos);
      this._updateVisible(true);
    } else {
      const currentPos = this._getContentMainPos();
      const distance = Math.abs(targetPos - currentPos);
      // 如果提供了 duration 则使用，否则根据距离自动计算
      const finalDuration = duration !== undefined ? duration : Math.max(0.2, distance / 3000);
      const targetVec = this._isVertical() ? new Vec3(0, targetPos, 0) : new Vec3(targetPos, 0, 0);
      this._scrollTween = tween(this.content!)
        .to(
          finalDuration,
          { position: targetVec },
          {
            easing: 'smooth',
            onUpdate: () => {
              this._updateVisible(false);
            },
          }
        )
        .call(() => {
          this._updateVisible(true);
          this._scrollTween = null;
          this._velocity = 0;
        })
        .start();
    }
  }

  /**
   * 滚动到列表起点
   * @param animate  是否使用动画
   * @param duration 动画时长（秒）
   */
  public scrollToTop(animate = false, duration?: number) {
    if (this._runOrQueueAfterStart(() => this.scrollToTop(animate, duration))) return;
    const target = this._isVertical() ? this._boundsMin : this._boundsMax;
    this._scrollToPosition(target, animate, duration);
  }

  /**
   * 在数据头部插入若干条后保持当前视觉锚点不变
   * 典型场景：聊天记录下拉刷新加载更早一批消息时，让原可见消息位置不跳动
   * @param insertCount 头部新增条数
   * @param newTotalCount 新的总条数（不传则使用 totalCount + insertCount）
   */
  public prependItems(insertCount: number, newTotalCount?: number) {
    if (this._runOrQueueAfterStart(() => this.prependItems(insertCount, newTotalCount))) return;
    if (!this.useVirtualList || insertCount <= 0) return;
    const oldPos = this._getContentMainPos();
    this.setTotalCount(newTotalCount ?? this.totalCount + insertCount);
    let anchorOffset = 0;
    if (this.useDynamicSize) {
      anchorOffset = this._prefixPositions[insertCount] || 0;
    } else {
      const line = Math.floor(insertCount / this.gridCount);
      anchorOffset = this.headerSpacing + line * (this.itemMainSize + this.spacing);
    }
    const sign = this._isVertical() ? 1 : -1;
    const targetPos = math.clamp(sign * anchorOffset + oldPos, this._boundsMin, this._boundsMax);
    this._velocity = 0;
    this._setContentMainPos(targetPos);
    this._updateVisible(true);
    if (this._isRefreshing) this.finishRefresh(true);
  }

  /**
   * 滚动到列表末端
   * @param animate  是否使用动画
   * @param duration 动画时长（秒）
   */
  public scrollToBottom(animate = false, duration?: number) {
    if (this._runOrQueueAfterStart(() => this.scrollToBottom(animate, duration))) return;
    const target = this._isVertical() ? this._boundsMax : this._boundsMin;
    this._scrollToPosition(target, animate, duration);
  }

  /**
   * 平滑滚动到指定 item
   * @param index    目标 item 索引
   * @param animate  是否使用动画
   * @param duration 动画时长（秒）
   */
  public scrollToIndex(index: number, animate = false, duration?: number) {
    if (this._runOrQueueAfterStart(() => this.scrollToIndex(index, animate, duration))) return;
    index = math.clamp(index | 0, 0, Math.max(0, this.totalCount - 1));
    let targetPos = 0;

    if (this.useDynamicSize) {
      // 不等大小模式：_prefixPositions 已经包含了 headerSpacing
      targetPos = this._prefixPositions[index] || 0;
    } else {
      // 等大小模式：需要手动加上 headerSpacing
      const line = Math.floor(index / this.gridCount);
      targetPos = this.headerSpacing + line * (this.itemMainSize + this.spacing);
    }

    // 横向模式：滚动方向相反，取负值
    if (!this._isVertical()) {
      targetPos = -targetPos;
    }

    if (this.enablePageSnap) {
      this._updateCurrentPage(this._getPageIndexByPosition(targetPos));
    }

    this._scrollToPosition(targetPos, animate, duration);
  }

  /**
   * 全局开关 item 的层级置顶（VScrollViewItem.onSortLayer）
   * @param onoff true 启用、false 关闭
   */
  public onOffSortLayer(onoff: boolean) {
    this._initSortLayerFlag = onoff;
    this._onOffSortLayerOperation();
  }

  /** 内部应用 _initSortLayerFlag 到全部槽位 */
  private _onOffSortLayerOperation() {
    for (const element of this._slotNodes) {
      const sitem = element?.getComponent(VScrollViewItem);
      if (sitem) {
        if (this._initSortLayerFlag) sitem.onSortLayer();
        else sitem.offSortLayer();
      }
    }
  }

  /** 立即跳转到指定坐标，无动画且打断惯性/tween */
  private _flashToPosition(targetPos: number) {
    targetPos = math.clamp(targetPos, this._boundsMin, this._boundsMax);
    if (this._scrollTween) {
      this._scrollTween.stop();
      this._scrollTween = null;
    }
    this._velocity = 0;
    this._isTouching = false;
    this._activeTouchId = -1;
    this._velSamples.length = 0;
    this._setContentMainPos(this.pixelAlign ? Math.round(targetPos) : targetPos);
    this._updateVisible(true);
  }

  /** 无动画跳转到起点 */
  public flashToTop() {
    if (this._runOrQueueAfterStart(() => this.flashToTop())) return;
    const target = this._isVertical() ? this._boundsMin : this._boundsMax;
    this._flashToPosition(target);
  }

  /** 无动画跳转到末端 */
  public flashToBottom() {
    if (this._runOrQueueAfterStart(() => this.flashToBottom())) return;
    const target = this._isVertical() ? this._boundsMax : this._boundsMin;
    this._flashToPosition(target);
  }

  /**
   * 无动画跳转到指定 item
   * @param index 目标 item 索引
   */
  public flashToIndex(index: number) {
    if (this._runOrQueueAfterStart(() => this.flashToIndex(index))) return;
    if (!this.useVirtualList) {
      console.warn('[VirtualScrollView] 简单滚动模式不支持 flashToIndex');
      return;
    }
    index = math.clamp(index | 0, 0, Math.max(0, this.totalCount - 1));
    let targetPos = 0;

    if (this.useDynamicSize) {
      // 不等大小模式：_prefixPositions 已经包含了 headerSpacing
      targetPos = this._prefixPositions[index] || 0;
    } else {
      // 等大小模式：需要手动加上 headerSpacing
      const line = Math.floor(index / this.gridCount);
      targetPos = this.headerSpacing + line * (this.itemMainSize + this.spacing);
    }

    if (!this._isVertical()) {
      targetPos = -targetPos;
    }

    if (this.enablePageSnap) {
      this._updateCurrentPage(this._getPageIndexByPosition(targetPos));
    }

    this._flashToPosition(targetPos);
  }

  /**
   * 仅重渲染指定索引（必须当前在可视范围内）
   * @param index 目标 item 索引
   */
  public refreshIndex(index: number) {
    if (!this.useVirtualList) {
      console.warn('[VirtualScrollView] 简单滚动模式不支持 refreshIndex');
      return;
    }
    const first = this._slotFirstIndex;
    const last = first + this._slots - 1;
    if (index < first || index > last) return;
    const slot = index - first;
    const node = this._slotNodes[slot];
    if (node && this.renderItemFn) this.renderItemFn(node, index);
  }

  /** 嵌套时阻止事件冒泡到父滚动视图 */
  private _stopTouchEvent(e?: EventTouch) {
    if (!e) return;
    if (this.blockParentScroll && this._shouldBlockParent) {
      e.propagationStopped = true;
    }
  }

  /** 触摸按下：清空速度采样、停止 tween、占有嵌套所有权 */
  private _onDown(e: EventTouch) {
    if (this._isTouching) {
      // 防止上一笔触摸异常未结束时，影响新一笔手势
      this._isTouching = false;
      this._activeTouchId = -1;
      this._velocity = 0;
      this._velSamples.length = 0;
      this._hasDeterminedScrollDirection = false;
      this._shouldBlockParent = false;
    }

    const uiPos = e.getUILocation(this._touchStartPos);
    this._touchStartPos.set(uiPos);
    this._hasDeterminedScrollDirection = false;
    this._shouldBlockParent = false;
    this._ensureParentScrollView();
    this._acquireNestedTouchOwner();

    if (this.enablePageSnap) {
      this._pageStartPos = this._getContentMainPos();
    }

    this._stopTouchEvent(e);
    this._isTouching = true;
    this._activeTouchId = this._extractTouchId(e);
    this._velocity = 0;
    this._velSamples.length = 0;
    if (this._scrollTween) {
      this._scrollTween.stop();
      this._scrollTween = null;
    }
  }

  /** 触摸移动：方向判定、嵌套让渡、阻尼边界、刷新/加载偏移、记录速度采样 */
  private _onMove(e: EventTouch) {
    if (!this._isTouching) return;

    const uiDelta = e.getUIDelta(this._tmpMoveVec2);
    const currentPos = e.getUILocation();
    const hasParent = !!this._ensureParentScrollView();

    if (!this._hasDeterminedScrollDirection) {
      const deltaX = currentPos.x - this._touchStartPos.x;
      const deltaY = currentPos.y - this._touchStartPos.y;
      const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (totalDelta <= this._scrollDirectionThreshold) return;

      this._hasDeterminedScrollDirection = true;
      const isListVertical = this._isVertical();
      let axisMatched = true;
      if (this.limitStartDragAngle) {
        const angleThreshold = math.clamp(this.startDragAngleThreshold, 0, 89);
        const angle = Math.abs((Math.atan2(deltaY, deltaX) * 180) / Math.PI);
        const isVerticalScroll = angle > 90 - angleThreshold && angle < 90 + angleThreshold;
        const isHorizontalScroll = angle < angleThreshold || angle > 180 - angleThreshold;
        axisMatched = (isListVertical && isVerticalScroll) || (!isListVertical && isHorizontalScroll);
      }
      const delta = isListVertical ? uiDelta.y : uiDelta.x;
      const sameAxisWithParent = hasParent && this._parentScrollView ? this._parentScrollView.direction === this.direction : false;

      if (!axisMatched) {
        this._isTouching = false;
        this._activeTouchId = -1;
        this._velocity = 0;
        this._velSamples.length = 0;
        this._releaseNestedTouchOwner();
        return;
      }

      const canHandle = this._canHandleMainAxisDelta(delta);
      // 仅在父子同轴时，子列表在边界且不可继续处理当前方向时才让给父列表
      if (sameAxisWithParent && !canHandle) {
        this._isTouching = false;
        this._activeTouchId = -1;
        this._velocity = 0;
        this._velSamples.length = 0;
        this._releaseNestedTouchOwner();
        return;
      }

      this._shouldBlockParent = hasParent && this.blockParentScroll;
      if (this._shouldBlockParent) {
        this._parentScrollView?._cancelTouchTrackingFromChild();
      }
    }

    this._stopTouchEvent(e);
    const delta = this._isVertical() ? uiDelta.y : uiDelta.x;
    let pos = this._getContentMainPos();
    const minBound = Math.min(this._boundsMin, this._boundsMax);
    const maxBound = Math.max(this._boundsMin, this._boundsMax);

    let finalDelta = delta;

    if (this.enablePullRefresh && !this._isRefreshing) {
      const atTopBound = this._isVertical() ? pos <= minBound : pos >= maxBound;
      const pullingDown = this._isVertical() ? delta < 0 : delta > 0;

      if (atTopBound && pullingDown) {
        const overOffset = this._isVertical() ? minBound - pos : pos - maxBound;
        const resistance = 1 - Math.min(overOffset / this.pullRefreshMaxOffset, 1) * (1 - this.pullDampingRate);
        finalDelta = delta * resistance;
        this._pullOffset = Math.min(overOffset + Math.abs(finalDelta), this.pullRefreshMaxOffset);

        if (this._pullOffset >= this.pullRefreshThreshold) {
          this._updateRefreshState(RefreshState.READY, this._pullOffset);
        } else {
          this._updateRefreshState(RefreshState.PULLING, this._pullOffset);
        }
      }
    }

    if (this.enableLoadMore && !this._isLoadingMore && this._hasMore) {
      const atBottomBound = this._isVertical() ? pos >= maxBound : pos <= minBound;
      const pullingUp = this._isVertical() ? delta > 0 : delta < 0;

      if (atBottomBound && pullingUp) {
        const overOffset = this._isVertical() ? pos - maxBound : minBound - pos;
        const resistance = 1 - Math.min(overOffset / this.loadMoreMaxOffset, 1) * (1 - this.pullDampingRate);
        finalDelta = delta * resistance;
        this._loadOffset = Math.min(overOffset + Math.abs(finalDelta), this.loadMoreMaxOffset);

        if (this._loadOffset >= this.loadMoreThreshold) {
          this._updateLoadMoreState(LoadMoreState.READY, this._loadOffset);
        } else {
          this._updateLoadMoreState(LoadMoreState.PULLING, this._loadOffset);
        }
      }
    }

    if (this.disableBounce) {
      const newPos = pos + finalDelta;
      if (newPos < minBound) {
        finalDelta = minBound - pos;
      } else if (newPos > maxBound) {
        finalDelta = maxBound - pos;
      }
    }

    pos += finalDelta;
    if (this.pixelAlign) pos = Math.round(pos);
    this._setContentMainPos(pos);

    const t = performance.now() / 1000;
    this._velSamples.push({ t, delta: finalDelta });
    const t0 = t - this.velocityWindow;
    while (this._velSamples.length && this._velSamples[0].t < t0) this._velSamples.shift();
    if (this.useVirtualList) this._updateVisible(false);
  }

  /** 触摸抬起：触发刷新/加载、根据采样估算惯性速度、分页吸附 */
  private _onUp(e?: EventTouch) {
    // 重置方向判断标志
    this._hasDeterminedScrollDirection = false;
    this._shouldBlockParent = false;

    this._stopTouchEvent(e);
    if (!this._isTouching) return;
    this._isTouching = false;
    this._activeTouchId = -1;
    this._releaseNestedTouchOwner();

    // 检查是否触发刷新
    if (this._refreshState === RefreshState.READY && !this._isRefreshing) {
      this._triggerRefresh();
      this._velSamples.length = 0;
      return;
    }

    // 检查是否触发加载
    if (this._loadMoreState === LoadMoreState.READY && !this._isLoadingMore) {
      this._triggerLoadMore();
      this._velSamples.length = 0;
      return;
    }

    // 重置状态
    if (this._refreshState !== RefreshState.REFRESHING) {
      this._pullOffset = 0;
      this._updateRefreshState(RefreshState.IDLE, 0);
    }
    if (this._loadMoreState !== LoadMoreState.LOADING) {
      this._loadOffset = 0;
      this._updateLoadMoreState(LoadMoreState.IDLE, 0);
    }

    // 计算速度
    if (this._velSamples.length >= 2) {
      let sum = 0;
      let dtSum = 0;
      const sampleCount = Math.min(this._velSamples.length, 5);
      const startIndex = this._velSamples.length - sampleCount;
      for (let i = startIndex + 1; i < this._velSamples.length; i++) {
        sum += this._velSamples[i].delta;
        dtSum += this._velSamples[i].t - this._velSamples[i - 1].t;
      }
      if (dtSum > 0.001) {
        this._velocity = sum / dtSum;
        this._velocity = math.clamp(this._velocity, -this.maxVelocity, this.maxVelocity);
      } else {
        this._velocity =
          this._velSamples.length > 0 ? math.clamp(this._velSamples[this._velSamples.length - 1].delta * 60, -this.maxVelocity, this.maxVelocity) : 0;
      }
    } else if (this._velSamples.length === 1) {
      this._velocity = math.clamp(this._velSamples[0].delta * 60, -this.maxVelocity, this.maxVelocity);
    } else {
      this._velocity = 0;
    }
    this._velSamples.length = 0;

    // 分页吸附模式：根据滑动距离判断翻页
    if (this.enablePageSnap) {
      this._performPageSnapByDistance();
    }
  }

  /** 更新下拉刷新状态机并回调外部 */
  private _updateRefreshState(state: RefreshState, offset: number) {
    if (this._refreshState === state) return;
    this._refreshState = state;
    if (this.onRefreshStateChangeFn) {
      this.onRefreshStateChangeFn(state, offset);
    }
  }

  /** 更新上拉加载状态机并回调外部 */
  private _updateLoadMoreState(state: LoadMoreState, offset: number) {
    if (this._loadMoreState === state) return;
    this._loadMoreState = state;
    if (this.onLoadMoreStateChangeFn) {
      this.onLoadMoreStateChangeFn(state, offset);
    }
  }

  /** 进入刷新中状态（保持在阈值位置） */
  private _triggerRefresh() {
    this._isRefreshing = true;
    this._velocity = 0;
    this._updateRefreshState(RefreshState.REFRESHING, this.pullRefreshThreshold);
  }

  /** 进入加载中状态（保持在阈值位置） */
  private _triggerLoadMore() {
    this._isLoadingMore = true;
    this._velocity = 0;
    this._updateLoadMoreState(LoadMoreState.LOADING, this.loadMoreThreshold);
  }

  /**
   * 完成刷新（外部调用）
   * @param success 是否刷新成功
   */
  public finishRefresh(success: boolean = true) {
    if (!this._isRefreshing) return;
    this._isRefreshing = false;
    this._pullOffset = 0;
    this._velocity = 0;
    this._updateRefreshState(success ? RefreshState.COMPLETE : RefreshState.IDLE, 0);

    // 延迟重置到 IDLE 状态
    this.scheduleOnce(() => {
      if (this._refreshState === RefreshState.COMPLETE) {
        this._updateRefreshState(RefreshState.IDLE, 0);
      }
    }, 0.3);
  }

  /**
   * 完成加载更多（外部调用）
   * @param hasMore 是否还有更多数据
   */
  public finishLoadMore(hasMore: boolean = true) {
    if (!this._isLoadingMore) return;
    this._isLoadingMore = false;
    this._loadOffset = 0;
    this._hasMore = hasMore;

    if (!hasMore) {
      this._updateLoadMoreState(LoadMoreState.NO_MORE, 0);
    } else {
      this._updateLoadMoreState(LoadMoreState.COMPLETE, 0);
      // 延迟重置到 IDLE 状态
      this.scheduleOnce(() => {
        if (this._loadMoreState === LoadMoreState.COMPLETE) {
          this._updateLoadMoreState(LoadMoreState.IDLE, 0);
        }
      }, 0.3);
    }
  }

  /**
   * 重置加载更多状态（当数据清空或重新加载时调用）
   */
  public resetLoadMoreState() {
    this._hasMore = true;
    this._isLoadingMore = false;
    this._loadOffset = 0;
    this._updateLoadMoreState(LoadMoreState.IDLE, 0);
  }

  /** 虚拟列表核心：根据滚动位置计算可见首索引并循环复用槽位 */
  private _updateVisible(force: boolean) {
    if (!this.useVirtualList) return;
    let scrollPos = this._getContentMainPos();
    let searchPos: number;
    if (this._isVertical()) {
      searchPos = math.clamp(scrollPos, 0, this._contentSize);
    } else {
      searchPos = math.clamp(-scrollPos, 0, this._contentSize);
    }

    let newFirst = 0;
    if (this.useDynamicSize) {
      const range = this._calcVisibleRange(searchPos);
      newFirst = range.start;
    } else {
      const stride = this.itemMainSize + this.spacing;
      // 减去 headerSpacing 后再计算行号
      const adjustedPos = Math.max(0, searchPos - this.headerSpacing);
      const firstLine = Math.floor(adjustedPos / stride);
      const first = firstLine * this.gridCount;
      newFirst = math.clamp(first, 0, Math.max(0, this.totalCount - 1));
    }
    if (this.totalCount < this._slots) newFirst = 0;
    if (force) {
      this._slotFirstIndex = newFirst;
      this._layoutSlots(this._slotFirstIndex, true);
      this._dispatchItemEnterCallbacks();
      return;
    }
    const diff = newFirst - this._slotFirstIndex;
    if (diff === 0) {
      this._dispatchItemEnterCallbacks();
      return;
    }
    if (Math.abs(diff) >= this._slots) {
      this._slotFirstIndex = newFirst;
      this._layoutSlots(this._slotFirstIndex, true);
      this._dispatchItemEnterCallbacks();
      return;
    }
    const absDiff = Math.abs(diff);
    if (diff > 0) {
      const moved = this._slotNodes.splice(0, absDiff);
      this._slotNodes.push(...moved);
      if (this.useDynamicSize && this._slotPrefabIndices.length > 0) {
        const movedIndices = this._slotPrefabIndices.splice(0, absDiff);
        this._slotPrefabIndices.push(...movedIndices);
      }
      this._slotFirstIndex = newFirst;
      for (let i = 0; i < absDiff; i++) {
        const slot = this._slots - absDiff + i;
        const idx = this._slotFirstIndex + slot;
        if (idx >= this.totalCount) {
          const node = this._slotNodes[slot];
          if (node) node.active = false;
        } else {
          this._layoutSingleSlot(this._slotNodes[slot], idx, slot);
        }
      }
    } else {
      const moved = this._slotNodes.splice(this._slotNodes.length + diff, absDiff);
      this._slotNodes.unshift(...moved);
      if (this.useDynamicSize && this._slotPrefabIndices.length > 0) {
        const movedIndices = this._slotPrefabIndices.splice(this._slotPrefabIndices.length + diff, absDiff);
        this._slotPrefabIndices.unshift(...movedIndices);
      }
      this._slotFirstIndex = newFirst;
      for (let i = 0; i < absDiff; i++) {
        const idx = this._slotFirstIndex + i;
        if (idx >= this.totalCount) {
          const node = this._slotNodes[i];
          if (node) node.active = false;
        } else {
          this._layoutSingleSlot(this._slotNodes[i], idx, i);
        }
      }
    }
    this._dispatchItemEnterCallbacks();
  }

  /** 渲染并定位单个槽位（含节点池切换、自动测量、入场动画、点击绑定） */
  private async _layoutSingleSlot(node: Node | null, idx: number, slot: number) {
    if (!this.useVirtualList) return;
    if (this.useDynamicSize) {
      let targetPrefabIndex = this.getItemTypeIndexFn(idx);
      const currentPrefabIndex = this._slotPrefabIndices[slot];
      let newNode: Node | null = null;
      if (currentPrefabIndex === targetPrefabIndex && this._slotNodes[slot]) {
        newNode = this._slotNodes[slot];
      } else {
        if (this._slotNodes[slot] && this._nodePool && currentPrefabIndex >= 0) {
          this._nodePool.put(this._slotNodes[slot], currentPrefabIndex);
        }
        if (this._nodePool) {
          newNode = this._nodePool.get(targetPrefabIndex);
          if (!newNode) {
            console.error(`[VScrollView] 无法获取类型 ${targetPrefabIndex} 的节点`);
            return;
          }
          newNode.parent = this.content;
          this._slotNodes[slot] = newNode;
          this._slotPrefabIndices[slot] = targetPrefabIndex;
        }
      }
      if (!newNode) {
        console.error(`[VScrollView] 槽位 ${slot} 节点为空，索引 ${idx}`);
        return;
      }
      newNode.active = true;
      this._updateItemClickHandler(newNode, idx);
      if (this.renderItemFn) this.renderItemFn(newNode, idx);
      if (this.getItemHeightFn) {
        const expectedSize = this.getItemHeightFn(idx);
        if (this._itemSizes[idx] !== expectedSize) {
          this.updateItemHeight(idx, expectedSize);
          return;
        }
      } else {
        const uit = newNode.getComponent(UITransform);
        const actualSize = this._isVertical() ? uit?.height || 100 : uit?.width || 100;
        if (Math.abs(this._itemSizes[idx] - actualSize) > 1) {
          this.updateItemHeight(idx, actualSize);
          return;
        }
      }
      const uit = newNode.getComponent(UITransform);
      const size = this._itemSizes[idx];
      const itemStart = this._prefixPositions[idx];
      if (this._isVertical()) {
        const anchorY = uit?.anchorY ?? 0.5;
        const anchorOffsetY = size * (1 - anchorY);
        const nodeY = itemStart + anchorOffsetY;
        const y = -nodeY;
        newNode.setPosition(0, this.pixelAlign ? Math.round(y) : y);
      } else {
        // 修改：横向模式下，itemStart 是正值，但 content.x 是负值
        // 所以 item 的 x 位置应该直接使用 itemStart（因为 content 整体向左移动）
        const anchorX = uit?.anchorX ?? 0.5;
        const anchorOffsetX = size * anchorX;
        const nodeX = itemStart + anchorOffsetX;
        // 不需要取负，因为 content 本身已经是负值了
        const x = nodeX;
        newNode.setPosition(this.pixelAlign ? Math.round(x) : x, 0);
      }
      if (this._needAnimateIndices.has(idx)) {
        if (this.playItemAppearAnimationFn) this.playItemAppearAnimationFn(newNode, idx);
        else this._playDefaultItemAppearAnimation(newNode, idx);
        this._needAnimateIndices.delete(idx);
      }
    } else {
      // 等大小模式
      if (!node) return;
      node.active = true;
      const stride = this.itemMainSize + this.spacing;
      const line = Math.floor(idx / this.gridCount);
      const gridPos = idx % this.gridCount;
      const uit = node.getComponent(UITransform);

      // 1. 计算基础位置（包含 headerSpacing）
      const itemStart = this.headerSpacing + line * stride;

      // 2. 计算全局偏移（视口居中）- 只在内容小于视口时生效
      let globalOffset = 0;
      let shouldAutoCenter = false; // 是否应该居中
      if (this.autoCenter) {
        const totalLines = Math.ceil(this.totalCount / this.gridCount);
        const totalContentSize = this.headerSpacing + totalLines * stride - this.spacing + this.footerSpacing;
        // 只有当内容小于视口时才居中
        if (totalContentSize < this._viewportSize) {
          shouldAutoCenter = true;
          globalOffset = (this._viewportSize - totalContentSize) / 2;
        }
      }

      if (this._isVertical()) {
        // 纵向模式：主方向是 Y，副方向是 X
        const anchorY = uit?.anchorY ?? 0.5;
        const anchorOffsetY = this.itemMainSize * (1 - anchorY);
        const nodeY = itemStart + anchorOffsetY + globalOffset;
        const y = -nodeY;

        // 3. 计算当前行的实际子项数量（行内居中）- 只在启用居中且内容小于视口时生效
        let actualCountInLine = this.gridCount;
        if (shouldAutoCenter) {
          const startIdxOfLine = line * this.gridCount;
          const endIdxOfLine = Math.min(startIdxOfLine + this.gridCount, this.totalCount);
          actualCountInLine = endIdxOfLine - startIdxOfLine;
        }

        // 根据实际数量计算总宽度和位置
        const totalWidth = actualCountInLine * this.itemCrossSize + (actualCountInLine - 1) * this.gridSpacing;
        const x = gridPos * (this.itemCrossSize + this.gridSpacing) - totalWidth / 2 + this.itemCrossSize / 2;

        node.setPosition(this.pixelAlign ? Math.round(x) : x, this.pixelAlign ? Math.round(y) : y);
        if (uit) {
          uit.width = this.itemCrossSize;
          uit.height = this.itemMainSize;
        }
      } else {
        // 横向模式：主方向是 X，副方向是 Y
        const anchorX = uit?.anchorX ?? 0.5;
        const anchorOffsetX = this.itemMainSize * anchorX;
        const nodeX = itemStart + anchorOffsetX + globalOffset;
        const x = nodeX;

        // 3. 计算当前列的实际子项数量（列内居中）- 只在启用居中且内容小于视口时生效
        let actualCountInLine = this.gridCount;
        if (shouldAutoCenter) {
          const startIdxOfLine = line * this.gridCount;
          const endIdxOfLine = Math.min(startIdxOfLine + this.gridCount, this.totalCount);
          actualCountInLine = endIdxOfLine - startIdxOfLine;
        }

        // 根据实际数量计算总高度和位置
        const totalHeight = actualCountInLine * this.itemCrossSize + (actualCountInLine - 1) * this.gridSpacing;
        const y = totalHeight / 2 - gridPos * (this.itemCrossSize + this.gridSpacing) - this.itemCrossSize / 2;

        node.setPosition(this.pixelAlign ? Math.round(x) : x, this.pixelAlign ? Math.round(y) : y);
        if (uit) {
          uit.width = this.itemMainSize;
          uit.height = this.itemCrossSize;
        }
      }
      this._updateItemClickHandler(node, idx);
      if (this.renderItemFn) this.renderItemFn(node, idx);
      if (this._needAnimateIndices.has(idx)) {
        if (this.playItemAppearAnimationFn) this.playItemAppearAnimationFn(node, idx);
        else this._playDefaultItemAppearAnimation(node, idx);
        this._needAnimateIndices.delete(idx);
      }
    }
  }

  /** 默认入场动画占位（业务可通过 playItemAppearAnimationFn 自定义覆盖） */
  private _playDefaultItemAppearAnimation(node: Node, index: number) {}

  /** 给槽位节点挂载 VScrollViewItem 并桥接点击/长按回调 */
  private _updateItemClickHandler(node: Node, index: number) {
    if (!this.useVirtualList) return;
    let itemScript = node.getComponent(VScrollViewItem);
    if (!itemScript) itemScript = node.addComponent(VScrollViewItem);
    this._initSortLayerFlag ? itemScript.onSortLayer() : itemScript.offSortLayer();
    itemScript.useItemClickEffect = this.onItemClickFn ? true : false;
    if (!itemScript.onClickCallback) {
      itemScript.onClickCallback = (idx: number) => {
        if (this.onItemClickFn) this.onItemClickFn(node, idx);
      };
    }
    if (!itemScript.onLongPressCallback) {
      itemScript.onLongPressCallback = (idx: number) => {
        if (this.onItemLongPressFn) this.onItemLongPressFn(node, idx);
      };
    }
    itemScript.setDataIndex(index);
  }

  /** 批量从指定首索引开始重布所有槽位 */
  private _layoutSlots(firstIndex: number, forceRender: boolean) {
    if (!this.useVirtualList) return;
    for (let s = 0; s < this._slots; s++) {
      const idx = firstIndex + s;
      const node = this._slotNodes[s];
      if (idx >= this.totalCount) {
        if (node) node.active = false;
      } else {
        this._layoutSingleSlot(node, idx, s);
      }
    }
  }

  /** 等大小模式重新计算 content 总尺寸与滚动边界 */
  private _recomputeContentSize() {
    if (!this.useVirtualList) {
      this._contentSize = this._isVertical() ? this._contentTf.height : this._contentTf.width;
      if (this._isVertical()) {
        this._boundsMin = 0;
        this._boundsMax = Math.max(0, this._contentSize - this._viewportSize);
      } else {
        this._boundsMin = -Math.max(0, this._contentSize - this._viewportSize);
        this._boundsMax = 0;
      }
      return;
    }
    if (this.useDynamicSize) return;
    const stride = this.itemMainSize + this.spacing;
    const totalLines = Math.ceil(this.totalCount / this.gridCount);
    // 添加 headerSpacing 和 footerSpacing
    this._contentSize = totalLines > 0 ? this.headerSpacing + totalLines * stride - this.spacing + this.footerSpacing : 0;
    if (this._isVertical()) this._contentTf.height = Math.max(this._contentSize, this._viewportSize);
    else this._contentTf.width = Math.max(this._contentSize, this._viewportSize);

    if (this._isVertical()) {
      this._boundsMin = 0;
      this._boundsMax = Math.max(0, this._contentSize - this._viewportSize);
    } else {
      this._boundsMin = -Math.max(0, this._contentSize - this._viewportSize);
      this._boundsMax = 0;
    }
  }

  /**
   * 获取当前页索引
   */
  public getCurrentPageIndex(): number {
    return this._currentPageIndex;
  }

  /**
   * 滚动到指定页
   */
  public scrollToPage(pageIndex: number, animate: boolean = true) {
    if (!this.enablePageSnap) {
      console.warn('[VScrollView] 未启用分页吸附模式');
      return;
    }

    const maxPage = this._getMaxPageIndex();
    pageIndex = math.clamp(pageIndex, 0, maxPage);

    const targetPos = this._getPagePosition(pageIndex);
    this._scrollToPosition(targetPos, animate, this.pageSnapDuration);

    this._updateCurrentPage(pageIndex);
  }

  /**
   * 获取最大页索引
   */
  private _getMaxPageIndex(): number {
    if (this.useDynamicSize) {
      return Math.max(0, this.totalCount - 1);
    } else {
      const totalLines = Math.ceil(this.totalCount / this.gridCount);
      return Math.max(0, totalLines - 1);
    }
  }

  /**
   * 根据当前位置计算最近的页索引
   */
  private _getNearestPageIndex(): number {
    const pos = this._getContentMainPos();
    const searchPos = this._isVertical() ? pos : -pos;

    if (this.useDynamicSize) {
      // 不等大小模式：根据 item 的中心位置判断
      let nearestIdx = 0;
      let minDist = Infinity;

      for (let i = 0; i < this.totalCount; i++) {
        const itemStart = this._prefixPositions[i];
        const itemSize = this._itemSizes[i];
        const itemCenter = itemStart + itemSize / 2;
        const dist = Math.abs(searchPos - itemStart);

        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }
      return nearestIdx;
    } else {
      // 等大小模式：根据行/列计算
      const stride = this.itemMainSize + this.spacing;
      const adjustedPos = Math.max(0, searchPos - this.headerSpacing);
      const line = Math.round(adjustedPos / stride);
      return math.clamp(line, 0, this._getMaxPageIndex());
    }
  }

  /**
   * 根据页索引计算目标位置
   */
  private _getPagePosition(pageIndex: number): number {
    let targetPos = 0;

    if (this.useDynamicSize) {
      targetPos = this._prefixPositions[pageIndex] || 0;
    } else {
      targetPos = this.headerSpacing + pageIndex * (this.itemMainSize + this.spacing);
    }

    // 横向模式取负值
    if (!this._isVertical()) {
      targetPos = -targetPos;
    }

    // 限制在边界范围内
    return math.clamp(targetPos, this._boundsMin, this._boundsMax);
  }

  /**
   * 更新当前页并触发回调
   */
  private _updateCurrentPage(pageIndex: number) {
    if (this._currentPageIndex !== pageIndex) {
      this._currentPageIndex = pageIndex;
      if (this.onPageChangeFn) {
        this.onPageChangeFn(pageIndex);
      }
    }
  }

  /**
   * 执行分页吸附
   */
  private _performPageSnap() {
    if (!this.enablePageSnap) return;

    // 如果正在 tween 吸附中，不重复执行
    if (this._scrollTween) return;

    const nearestPage = this._getNearestPageIndex();
    const targetPage = math.clamp(nearestPage, 0, this._getMaxPageIndex());

    const targetPos = this._getPagePosition(targetPage);
    const currentPos = this._getContentMainPos();

    // 如果已经在目标位置，只更新页码
    if (Math.abs(targetPos - currentPos) < 1) {
      this._updateCurrentPage(targetPage);
      return;
    }

    this._velocity = 0;
    this._scrollToPosition(targetPos, true, this.pageSnapDuration);

    this._updateCurrentPage(targetPage);
  }
  /**
   * 根据滑动距离执行分页吸附
   */
  private _performPageSnapByDistance() {
    if (!this.enablePageSnap) return;
    if (this._scrollTween) return;

    const currentPos = this._getContentMainPos();
    const dragDistance = currentPos - this._pageStartPos; // 滑动距离

    // 获取当前页的尺寸
    const pageSize = this._getCurrentPageSize();

    // 判断翻页的距离阈值
    const threshold = pageSize * this.pageSnapDistanceRatio;

    // 基于当前页索引计算目标页
    let targetPage = this._currentPageIndex;
    const maxPage = this._getMaxPageIndex();

    if (this._isVertical()) {
      // 纵向：dragDistance > 0 表示向下滑（看上一页），< 0 表示向上滑（看下一页）
      if (dragDistance > threshold) {
        targetPage = this._currentPageIndex + 1;
      } else if (dragDistance < -threshold) {
        targetPage = this._currentPageIndex - 1;
      }
    } else {
      // 横向：dragDistance < 0 表示向左滑（看下一页），> 0 表示向右滑（看上一页）
      if (dragDistance < -threshold) {
        targetPage = this._currentPageIndex + 1;
      } else if (dragDistance > threshold) {
        targetPage = this._currentPageIndex - 1;
      }
    }

    // 限制范围
    targetPage = math.clamp(targetPage, 0, maxPage);

    const targetPos = this._getPagePosition(targetPage);

    // 如果已经在目标位置，只更新页码
    if (Math.abs(targetPos - currentPos) < 1) {
      this._updateCurrentPage(targetPage);
      this._velocity = 0;
      return;
    }

    this._velocity = 0;
    this._scrollToPosition(targetPos, true, this.pageSnapDuration);
    this._updateCurrentPage(targetPage);
  }

  /**
   * 获取当前页的尺寸
   */
  private _getCurrentPageSize(): number {
    if (this.useDynamicSize) {
      const pageIndex = math.clamp(this._currentPageIndex, 0, this.totalCount - 1);
      return this._itemSizes[pageIndex] || 100;
    } else {
      return this.itemMainSize + this.spacing;
    }
  }

  /**
   * 根据位置计算页索引
   */
  private _getPageIndexByPosition(pos: number): number {
    const searchPos = this._isVertical() ? pos : -pos;

    if (this.useDynamicSize) {
      return this._posToFirstIndex(searchPos);
    } else {
      const stride = this.itemMainSize + this.spacing;
      const adjustedPos = Math.max(0, searchPos - this.headerSpacing);
      const line = Math.floor(adjustedPos / stride);
      return math.clamp(line, 0, this._getMaxPageIndex());
    }
  }
}
