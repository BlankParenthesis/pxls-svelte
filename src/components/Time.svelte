<script lang="ts">
	export let time: Date;
</script>
<style>
</style>
<time datetime={time.toISOString()}>
	{time.toLocaleDateString()}
</time>