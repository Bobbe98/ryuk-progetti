# Keep serializable model classes used for Room JSON converters
-keep,includedescriptorclasses class com.ryuk.automation.data.model.**$$serializer { *; }
-keepclassmembers class com.ryuk.automation.data.model.** {
    *** Companion;
}
-keepclasseswithmembers class com.ryuk.automation.data.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}
