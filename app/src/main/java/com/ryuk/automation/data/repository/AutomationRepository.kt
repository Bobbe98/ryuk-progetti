package com.ryuk.automation.data.repository

import android.content.Context
import com.ryuk.automation.data.db.AppDatabase
import com.ryuk.automation.data.db.AutomationEntity
import com.ryuk.automation.data.model.Automation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class AutomationRepository(context: Context) {
    private val dao = AppDatabase.get(context).automationDao()

    fun observeAll(): Flow<List<Automation>> = dao.observeAll().map { list -> list.map { it.toDomain() } }

    suspend fun getEnabled(): List<Automation> = dao.getEnabled().map { it.toDomain() }

    suspend fun getById(id: Long): Automation? = dao.getById(id)?.toDomain()

    suspend fun save(automation: Automation): Long = dao.upsert(AutomationEntity.fromDomain(automation))

    suspend fun delete(automation: Automation) = dao.delete(AutomationEntity.fromDomain(automation))

    suspend fun setEnabled(id: Long, enabled: Boolean) = dao.setEnabled(id, enabled)

    suspend fun touchLastRun(id: Long) = dao.touchLastRun(id, System.currentTimeMillis())

    companion object {
        @Volatile private var instance: AutomationRepository? = null
        fun get(context: Context): AutomationRepository = instance ?: synchronized(this) {
            instance ?: AutomationRepository(context).also { instance = it }
        }
    }
}
