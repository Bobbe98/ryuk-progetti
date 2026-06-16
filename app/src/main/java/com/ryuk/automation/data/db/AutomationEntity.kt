package com.ryuk.automation.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.ryuk.automation.data.model.Action
import com.ryuk.automation.data.model.Automation
import com.ryuk.automation.data.model.Condition
import com.ryuk.automation.data.model.Trigger
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true; classDiscriminator = "type" }

@Entity(tableName = "automations")
@TypeConverters(AutomationConverters::class)
data class AutomationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val enabled: Boolean,
    val trigger: Trigger,
    val conditions: List<Condition>,
    val actions: List<Action>,
    val lastRunAt: Long? = null
) {
    fun toDomain() = Automation(id, name, enabled, trigger, conditions, actions, lastRunAt)

    companion object {
        fun fromDomain(a: Automation) = AutomationEntity(a.id, a.name, a.enabled, a.trigger, a.conditions, a.actions, a.lastRunAt)
    }
}

class AutomationConverters {
    @TypeConverter
    fun triggerToJson(trigger: Trigger): String = json.encodeToString(trigger)

    @TypeConverter
    fun jsonToTrigger(value: String): Trigger = json.decodeFromString(value)

    @TypeConverter
    fun conditionsToJson(conditions: List<Condition>): String = json.encodeToString(conditions)

    @TypeConverter
    fun jsonToConditions(value: String): List<Condition> = json.decodeFromString(value)

    @TypeConverter
    fun actionsToJson(actions: List<Action>): String = json.encodeToString(actions)

    @TypeConverter
    fun jsonToActions(value: String): List<Action> = json.decodeFromString(value)
}
