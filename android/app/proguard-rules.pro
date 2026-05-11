# MyFinances ProGuard rules — Capacitor 8 + Plugins (App, Browser, Filesystem)

# Capacitor core: bridge usa reflection pra resolver plugin classes/methods
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
}
-keep class com.getcapacitor.plugin.** { *; }

# Plugins instalados
-keep class com.capacitorjs.plugins.app.** { *; }
-keep class com.capacitorjs.plugins.browser.** { *; }
-keep class com.capacitorjs.plugins.filesystem.** { *; }

# Cordova-style bridge (capacitor-cordova-android-plugins)
-keep class org.apache.cordova.** { *; }
-keep class com.cordova.** { *; }

# WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX nao deve ser ofuscado
-dontwarn androidx.**
-keep class androidx.** { *; }

# Reflexao e annotations
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
