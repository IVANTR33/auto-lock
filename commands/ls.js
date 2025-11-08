const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'ls',
    description: 'Busca canales bloqueados por uno o varios Pokémon específicos en este servidor.',
    async execute(client, message, args, { lockedChannels, paginationStates, generatePaginationButtons }) {
        // 1. Parsear los argumentos: dividir por coma, limpiar espacios y convertir a minúsculas
        const searchPokemonNames = args.join(' ').toLowerCase().split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0); // Filtrar cadenas vacías

        if (searchPokemonNames.length === 0) {
            return message.reply('❌ Proporciona uno o más nombres de Pokémon separados por comas para buscar (ej: `!ls pichu, pikachu`).');
        }

        const searchPokemonString = searchPokemonNames.join(', '); // String para usar en el título del embed y respuestas
        const pokemonCounts = {}; // Objeto para contar las coincidencias

        try {
            const lockedList = Array.from(lockedChannels.entries())
                .map(([id, data]) => {
                    const channel = client.channels.cache.get(id);

                    // Lógica de filtrado
                    const isServerMatch = channel && channel.guild.id === message.guild.id;
                    
                    let matchedName = null;
                    const isPokemonMatch = searchPokemonNames.some(searchName => {
                        if (data.pokemon.toLowerCase().includes(searchName)) {
                            // Encontramos una coincidencia. Almacenamos el nombre buscado para contar.
                            matchedName = searchName; 
                            return true;
                        }
                        return false;
                    });
                    
                    if (isServerMatch && isPokemonMatch) {
                        // Incrementar el contador para el Pokémon que coincidió
                        pokemonCounts[matchedName] = (pokemonCounts[matchedName] || 0) + 1;

                        return {
                            id,
                            channelName: channel.name,
                            pokemon: data.pokemon, // El nombre exacto en el bloqueo
                            type: data.type === 'private' ? 'Privado' : 'Público'
                        };
                    } else {
                        return null;
                    }
                })
                .filter(item => item !== null)
                .sort((a, b) => a.pokemon.localeCompare(b.pokemon));

            if (lockedList.length === 0) {
                return message.reply(`No hay canales bloqueados que coincidan con "${searchPokemonString}" en este servidor.`);
            }

            const itemsPerPage = 5;
            const totalPages = Math.ceil(lockedList.length / itemsPerPage);

            const getCountSummary = () => {
                // Genera el texto de resumen de conteo
                return Object.entries(pokemonCounts)
                    .map(([name, count]) => `**${name.charAt(0).toUpperCase() + name.slice(1)}**: ${count}`)
                    .join(' | ');
            };

            const generateEmbed = (currentPage) => {
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const currentItems = lockedList.slice(start, end);

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`🔍 Bloqueos locales coincidentes (${lockedList.length} Canales)`)
                    .setDescription(
                        `*Coincidencias por Pokémon:* ${getCountSummary()}\n\n` + // Aquí se muestra el conteo
                        currentItems.map(item =>
                            `🔒 **${item.pokemon}** (Canal ${item.channelName})\n` +
                            `• Tipo: ${item.type}\n` +
                            `• [Ir al Canal](https://discord.com/channels/${message.guild.id}/${item.id})`
                        ).join('\n\n')
                    )
                    .setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });

                return embed;
            };

            const initialState = {
                currentPage: 0,
                lockedList,
                itemsPerPage,
                totalPages,
                pokemon: searchPokemonString, 
                pokemonCounts, // Guardamos el conteo para la paginación
                messageAuthorId: message.author.id,
                commandName: 'ls',
                customPrefix: 'ls_'
            };
            const reply = await message.reply({
                embeds: [generateEmbed(initialState.currentPage)],
                components: [generatePaginationButtons(initialState.currentPage, totalPages, 'ls_')],
                fetchReply: true
            });

            paginationStates.set(reply.id, initialState);
        } catch (error) {
            console.error('❌ Error en comando LS:', error);
            message.reply('❌ Ocurrió un error al buscar los canales bloqueados.');
        }
    },
    handlePagination: async (interaction, state, generatePaginationButtons) => {
        if (interaction.customId.includes('_close_list')) return interaction.message.delete().catch(() => {});
        if (interaction.user.id !== state.messageAuthorId) {
            return interaction.reply({
                content: '❌ Solo el autor del comando puede interactuar con esta paginación.',
                ephemeral: true
            });
        }

        if (interaction.customId === 'ls_prev_page' && state.currentPage > 0) {
            state.currentPage--;
        } else if (interaction.customId === 'ls_next_page' && state.currentPage < state.totalPages - 1) {
            state.currentPage++;
        } else if (interaction.customId === 'ls_close_list') {
            paginationStates.delete(interaction.message.id);
            return interaction.message.delete().catch(() => interaction.update({ components: [] }));
        }

        const start = state.currentPage * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const currentItems = state.lockedList.slice(start, end);

        const getCountSummary = () => {
            // Genera el texto de resumen de conteo (usando el estado guardado)
            return Object.entries(state.pokemonCounts)
                .map(([name, count]) => `**${name.charAt(0).toUpperCase() + name.slice(1)}**: ${count}`)
                .join(' | ');
        };

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🔍 Bloqueos locales coincidentes (${state.lockedList.length} Canales)`)
            .setDescription(
                `*Coincidencias por Pokémon:* ${getCountSummary()}\n\n` + // Se muestra el conteo
                currentItems.map(item =>
                    `🔒 **${item.pokemon}** (Canal ${item.channelName})\n` +
                    `• Tipo: ${item.type}\n` +
                    `• [Ir al Canal](https://discord.com/channels/${interaction.guild.id}/${item.id})`
                ).join('\n\n')
            )
            .setFooter({ text: `Página ${state.currentPage + 1} de ${state.totalPages}` });

        await interaction.update({ 
            embeds: [embed], 
            components: [generatePaginationButtons(state.currentPage, state.totalPages, 'ls_')] 
        });
    }
};
