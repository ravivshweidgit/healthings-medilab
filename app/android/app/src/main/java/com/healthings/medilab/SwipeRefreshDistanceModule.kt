package com.healthings.medilab

import android.app.Activity
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Raise Android pull-to-refresh trigger distance (default ~64dp is too twitchy on dashboard).
 */
@ReactModule(name = SwipeRefreshDistanceModule.NAME)
class SwipeRefreshDistanceModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun setTriggerDistanceDip(dip: Double) {
    val activity: Activity = reactContext.currentActivity ?: return
    val px =
      TypedValue
        .applyDimension(
          TypedValue.COMPLEX_UNIT_DIP,
          dip.toFloat(),
          activity.resources.displayMetrics,
        ).toInt()
        .coerceAtLeast(1)

    activity.runOnUiThread {
      val root = activity.window?.decorView ?: return@runOnUiThread
      applyRecursive(root, px)
    }
  }

  private fun applyRecursive(view: View, triggerPx: Int) {
    if (view is SwipeRefreshLayout) {
      view.setDistanceToTriggerSync(triggerPx)
    }
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        applyRecursive(view.getChildAt(i), triggerPx)
      }
    }
  }

  companion object {
    const val NAME = "HealthingsSwipeRefresh"
  }
}
