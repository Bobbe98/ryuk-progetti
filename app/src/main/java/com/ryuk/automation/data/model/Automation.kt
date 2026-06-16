package com.ryuk.automation.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Automation(
    val id: Long = 0,
    val name: String,
    val enabled: Boolean = true,
    val trigger: Trigger,
    val conditions: List<Condition> = emptyList(),
    val actions: List<Action> = emptyList(),
    val lastRunAt: Long? = null
)
