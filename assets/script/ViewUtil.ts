/*
 * @Author: dgflash
 * @Date: 2021-08-16 09:34:56
 * @LastEditors: dgflash
 * @LastEditTime: 2023-01-19 14:52:12
 */
import { Animation, AnimationClip, EventTouch, instantiate, Node, Prefab, Size, UITransform, v3, Vec3, Sprite, Label, ImageAsset, Texture2D, SpriteFrame, assetManager, Sorting2D, settings } from "cc";

/** 显示对象工具 */
export class ViewUtil {

    /**
     * 节点之间坐标互转
     * @param a         A节点
     * @param b         B节点
     * @param aPos      A节点空间中的相对位置
     */
    static calculateASpaceToBSpacePos(a: Node, b: Node, aPos: Vec3): Vec3 {
        const world: Vec3 = a.getComponent(UITransform)!.convertToWorldSpaceAR(aPos);
        return b.getComponent(UITransform)!.convertToNodeSpaceAR(world);
    }

    /**
     * 屏幕转空间坐标
     * @param event 触摸事件
     * @param space 转到此节点的坐标空间
     */
    static calculateScreenPosToSpacePos(event: EventTouch, space: Node): Vec3 {
        const uil = event.getUILocation();
        const worldPos: Vec3 = v3(uil.x, uil.y);
        return space.getComponent(UITransform)!.convertToNodeSpaceAR(worldPos);
    }

    
}