<script lang="ts">
    import type { Authentication } from "../lib/authentication";
    import Login from "./Login.svelte";

	export let auth: Authentication;
</script>
<style>
</style>
<h2>Account</h2>
<p>You go here</p>
<Login {auth} />