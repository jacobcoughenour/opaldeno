<!-- comment -->

<script lang="ts">

	console.log("hello world <> </>");
	let color: string = "red";

	let rotation: number = 0;

	if (rotation < 100) {
		rotation += 1;
	}

	tick((delta) => {
		rotation += delta * 0.5;
		rotation %= 360;
	});

</script>

<x>
	<y>
		<z/>
	</y>
	<w></w>
</x>

<scene name="demo scene">
	<box visible {color} rotation.degrees.y={rotation} />
</scene>