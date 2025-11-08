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

        try {
            const lockedList = Array.from(lockedChannels.entries())
                .map(([id, data]) => {
                    const channel = client.channels.cache.get(id);

                    // 2. Lógica de filtrado: Debe estar en el servidor actual Y su Pokémon debe incluir AL MENOS UNO de los nombres buscados.
                    const isServerMatch = channel && channel.guild.id === message.guild.id;
                    const isPokemonMatch = searchPokemonNames.some(searchName => 
                        data.pokemon.toLowerCase().includes(searchName)
                    );
                    
                    if (isServerMatch && isPokemonMatch) {
                        return {
                            id,
                            channelName: channel.name,
                            pokemon: data.pokemon,
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

            const generateEmbed = (currentPage) => {
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const currentItems = lockedList.slice(start, end);

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    // 3. Título ajustado para múltiples Pokémon
                    .setTitle(`🔍 Bloqueos locales coincidentes (${lockedList.length})`)
                    .setDescription(`Búsqueda: **${searchPokemonString}**\n\n` + 
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
                pokemon: searchPokemonString, // Guardamos el string de búsqueda
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

        // 4. Se ha cambiado el título y añadido el campo de búsqueda
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🔍 Bloqueos locales coincidentes (${state.lockedList.length})`)
            .setDescription(`Búsqueda: **${state.pokemon}**\n\n` + 
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
