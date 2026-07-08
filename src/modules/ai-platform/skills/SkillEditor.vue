<template>
  <q-page class="q-pa-lg">
    <q-btn flat icon="arrow_back" to="/ai/skills" label="Back to Skills" class="q-mb-md" />
    <div class="text-h5 text-weight-bold">Skill Editor — {{ $route.params.id }}</div>
  </q-page>
</template>
<script>
import { defineComponent } from 'vue'
export default defineComponent({ name: 'SkillEditor' })
</script>
